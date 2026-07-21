import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  crmEmpresas,
  crmContatos,
  crmPipelines,
  crmEtapas,
  crmOportunidades,
  crmLeadInbox,
} from '@/lib/db/schema'
import { hojeBrasilia } from '@/lib/date-br'
import { normalizarTelefone, dedupHash } from '@/lib/crm/lead'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
import { ehLeadFrio, NOME_PIPELINE_FRIO } from '@/lib/crm/roteamento'
import type { LeadEntrada } from '@/lib/validations/crm'

// Ingestão de leads COMPARTILHADA entre a API pública (/api/crm/leads) e
// qualquer entrada manual futura. Módulo server comum — SEM 'use server':
// não é action nem endpoint; roda sem sessão de usuário (autorNome 'Sistema').
//
// ⚠️ QUERIES SEQUENCIAIS (nada de paralelizar com Promise): pool max=3 com
// max_pipeline=0 — ver o comentário longo em src/lib/db/index.ts.

export type ResultadoLead =
  | { duplicado: true }
  | { duplicado?: false; contatoId: string; oportunidadeId: string }

/**
 * Processa um lead validado: inbox (dedup por hash) → contato (dedup por
 * email/telefone) → oportunidade na 1ª etapa do pipeline destino (Frio para a
 * fonte 'prospeccao_fria', padrão "Vendas" para o resto) → atividades.
 * Idempotente por dia: o MESMO lead da MESMA fonte no MESMO dia (Brasília)
 * retorna { duplicado: true } sem criar nada — trava final no uniqueIndex
 * de crm_lead_inbox.dedup_hash.
 */
export async function processarLead(lead: LeadEntrada, workspaceId: string): Promise<ResultadoLead> {
  // (a) identidade do lead
  const telefoneNormalizado = normalizarTelefone(lead.telefone)
  const hash = dedupHash(lead.fonte, lead.email ?? null, telefoneNormalizado, hojeBrasilia())

  // (b) inbox com trava de idempotência: sem linha retornada = duplicado.
  const [inbox] = await db
    .insert(crmLeadInbox)
    .values({
      workspaceId,
      fonte: lead.fonte,
      payload: lead,
      dedupHash: hash,
    })
    .onConflictDoNothing({ target: crmLeadInbox.dedupHash })
    .returning({ id: crmLeadInbox.id })

  if (!inbox) return { duplicado: true }

  try {
    // (c) dedup de contato por email (case-insensitive) OU telefone normalizado.
    let contatoId: string | null = null

    if (lead.email) {
      const [porEmail] = await db
        .select({ id: crmContatos.id })
        .from(crmContatos)
        .where(
          and(
            eq(crmContatos.workspaceId, workspaceId),
            sql`lower(${crmContatos.email}) = lower(${lead.email})`
          )
        )
        .limit(1)
      contatoId = porEmail?.id ?? null
    }

    if (!contatoId && telefoneNormalizado) {
      const [porTelefone] = await db
        .select({ id: crmContatos.id })
        .from(crmContatos)
        .where(
          and(
            eq(crmContatos.workspaceId, workspaceId),
            eq(crmContatos.telefoneNormalizado, telefoneNormalizado)
          )
        )
        .limit(1)
      contatoId = porTelefone?.id ?? null
    }

    // Empresa: acha por nome no workspace ou cria mínima (só quando veio no lead).
    let empresaId: string | null = null
    if (lead.empresa) {
      const [empresaExistente] = await db
        .select({ id: crmEmpresas.id })
        .from(crmEmpresas)
        .where(and(eq(crmEmpresas.workspaceId, workspaceId), eq(crmEmpresas.nome, lead.empresa)))
        .limit(1)

      if (empresaExistente) {
        empresaId = empresaExistente.id
      } else {
        const [empresaNova] = await db
          .insert(crmEmpresas)
          .values({ workspaceId, nome: lead.empresa })
          .returning({ id: crmEmpresas.id })
        empresaId = empresaNova.id
      }
    }

    if (!contatoId) {
      const [contatoNovo] = await db
        .insert(crmContatos)
        .values({
          workspaceId,
          nome: lead.nome,
          email: lead.email ?? null,
          telefone: lead.telefone ?? null,
          telefoneNormalizado,
          empresaId,
          origem: lead.fonte,
          origemDetalhe: lead,
        })
        .returning({ id: crmContatos.id })
      contatoId = contatoNovo.id

      await registrarAtividadeCrm(workspaceId, null, {
        tipo: 'contato_criado',
        contatoId,
        detalhe: lead.nome,
      })
    }

    // (d) ROTEAMENTO por fonte → pipeline destino e sua PRIMEIRA etapa.
    //   - fonte 'prospeccao_fria': funil "Prospecção Fria" na etapa "A Abordar"
    //     (1ª etapa, menor ordem — nasce em ordem 0 no seed).
    //   - qualquer outra fonte: funil padrão "Vendas" (comportamento atual).
    // Queries SEQUENCIAIS (nada de Promise.all): pool max=3, max_pipeline=0.
    let pipelineDestino: { id: string } | undefined

    if (ehLeadFrio(lead.fonte)) {
      // DEGRADAÇÃO GRACIOSA: se o pipeline Frio ainda NÃO existir (seed não
      // aplicado), cai no padrão em vez de quebrar a ingestão — o roteamento
      // passa a valer no instante em que o orquestrador rodar o seed.
      const [pipelineFrio] = await db
        .select({ id: crmPipelines.id })
        .from(crmPipelines)
        .where(
          and(
            eq(crmPipelines.workspaceId, workspaceId),
            eq(crmPipelines.nome, NOME_PIPELINE_FRIO)
          )
        )
        .limit(1)
      pipelineDestino = pipelineFrio
    }

    if (!pipelineDestino) {
      const [pipelinePadrao] = await db
        .select({ id: crmPipelines.id })
        .from(crmPipelines)
        .where(and(eq(crmPipelines.workspaceId, workspaceId), eq(crmPipelines.padrao, true)))
        .limit(1)
      pipelineDestino = pipelinePadrao
    }

    if (!pipelineDestino) throw new Error('Pipeline padrao nao encontrado no workspace.')

    const [primeiraEtapa] = await db
      .select({ id: crmEtapas.id })
      .from(crmEtapas)
      .where(eq(crmEtapas.pipelineId, pipelineDestino.id))
      .orderBy(asc(crmEtapas.ordem))
      .limit(1)

    if (!primeiraEtapa) throw new Error('Pipeline destino sem etapas.')

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(
        and(eq(crmOportunidades.etapaId, primeiraEtapa.id), eq(crmOportunidades.status, 'aberta'))
      )

    const titulo = lead.empresa ? `Lead: ${lead.nome} (${lead.empresa})` : `Lead: ${lead.nome}`

    const [oportunidade] = await db
      .insert(crmOportunidades)
      .values({
        workspaceId,
        pipelineId: pipelineDestino.id,
        etapaId: primeiraEtapa.id,
        empresaId,
        contatoId,
        titulo,
        valor: lead.valorEstimado !== undefined ? String(lead.valorEstimado) : null,
        origem: lead.fonte,
        servicosInteresse: lead.servicosInteresse ?? null,
        donoId: null,
        status: 'aberta',
        ordemNaEtapa: total,
      })
      .returning({ id: crmOportunidades.id })

    // (e) timeline: chegada do lead + criação da oportunidade (autor 'Sistema').
    await registrarAtividadeCrm(workspaceId, null, {
      tipo: 'lead_recebido',
      oportunidadeId: oportunidade.id,
      contatoId,
      empresaId,
      detalhe: lead.fonte,
    })
    await registrarAtividadeCrm(workspaceId, null, {
      tipo: 'criacao',
      oportunidadeId: oportunidade.id,
      contatoId,
      empresaId,
      detalhe: titulo,
    })

    // (f) fecha o ciclo do inbox.
    await db
      .update(crmLeadInbox)
      .set({
        status: 'processado',
        processadoEm: new Date(),
        contatoId,
        oportunidadeId: oportunidade.id,
      })
      .where(eq(crmLeadInbox.id, inbox.id))

    return { contatoId, oportunidadeId: oportunidade.id }
  } catch (erro) {
    // Trilha de erro no inbox (try/catch PRÓPRIO — não pode mascarar o erro real).
    try {
      await db
        .update(crmLeadInbox)
        .set({
          status: 'erro',
          erroDetalhe: erro instanceof Error ? erro.message : String(erro),
        })
        .where(eq(crmLeadInbox.id, inbox.id))
    } catch (erroInbox) {
      console.error('[processarLead] falha ao registrar erro no inbox', erroInbox)
    }
    throw erro
  }
}
