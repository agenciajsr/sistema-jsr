'use server'

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { db } from '@/lib/db'
import {
  clientes,
  contratos,
  crmEmpresas,
  crmContatos,
  crmPipelines,
  crmEtapas,
  crmOportunidades,
  crmAtividades,
} from '@/lib/db/schema'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
import { carimbarPrimeiroContato } from '@/lib/crm/primeiro-contato'
import { ehEtapaAbordado, ehEtapaFollowup, ehEtapaQualificado } from '@/lib/crm/followup'
import { ehPipelineFrio, NOME_PIPELINE_FRIO } from '@/lib/crm/roteamento'
import { clienteExistenteDe, dadosClienteDe } from '@/lib/crm/conversao'
import { montarDadosContrato, gerarToken } from '@/lib/contratos/fluxo'
import { servicosContratadosSchema, somaServicos } from '@/lib/contratos/servicos-contratados'
import { hojeBrasilia } from '@/lib/date-br'
import {
  pipelineSchema,
  etapaSchema,
  oportunidadeSchema,
  atualizarOportunidadeSchema,
  type PipelineInput,
  type EtapaInput,
  type OportunidadeInput,
  type AtualizarOportunidadeInput,
} from '@/lib/validations/crm'

// Pipelines, etapas e oportunidades — o coração do CRM.
// Padrão do repo: toda action devolve { data } | { error } e começa pelo
// getCurrentUser(). Mutação termina em revalidatePath('/crm').
//
// ⚠️ QUERIES SEQUENCIAIS (nada de paralelizar com Promise): pool max=3 com
// max_pipeline=0 — ver o comentário longo em src/lib/db/index.ts.
//
// Padrão Pipedrive: ganho/perdido são STATUS ('ganha'/'perdida') da
// oportunidade, nunca etapas do pipeline.

/** Traduz o erro do Zod na primeira mensagem legível. */
function primeiroErro(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? 'Dados invalidos.'
}

// --- Pipelines ---

export async function criarPipeline(input: PipelineInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = pipelineSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  try {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmPipelines)
      .where(eq(crmPipelines.workspaceId, workspace.id))

    const [pipeline] = await db
      .insert(crmPipelines)
      .values({
        workspaceId: workspace.id,
        nome: parsed.data.nome,
        ordem: total,
        // O primeiro pipeline do workspace nasce como padrão.
        padrao: total === 0,
      })
      .returning({ id: crmPipelines.id })

    revalidatePath('/crm')
    return { data: { id: pipeline.id } }
  } catch (e) {
    console.error('[criarPipeline]', e)
    return { error: 'Nao foi possivel criar o pipeline.' }
  }
}

/**
 * Cria um pipeline JÁ COM as 6 etapas padrão (mesmo seed da migration 0019).
 * É o caminho do botão "Nova pipeline" da /crm — um pipeline sem etapas não
 * aceita negócios, então nunca criamos um vazio pela UI.
 */
export async function criarPipelineComEtapas(input: PipelineInput) {
  const criado = await criarPipeline(input)
  if ('error' in criado && criado.error) return criado
  const id = (criado as { data: { id: string } }).data.id

  try {
    const ETAPAS_PADRAO = [
      { nome: 'Novo Lead', ordem: 0, probabilidade: 10 },
      { nome: 'Contato Feito', ordem: 1, probabilidade: 20 },
      { nome: 'Qualificado', ordem: 2, probabilidade: 40 },
      { nome: 'Reunião Agendada', ordem: 3, probabilidade: 60 },
      { nome: 'Proposta Enviada', ordem: 4, probabilidade: 75 },
      { nome: 'Negociação', ordem: 5, probabilidade: 90 },
    ]
    await db.insert(crmEtapas).values(ETAPAS_PADRAO.map((e) => ({ ...e, pipelineId: id })))

    revalidatePath('/crm')
    return { data: { id } }
  } catch (e) {
    console.error('[criarPipelineComEtapas]', e)
    return { error: 'Pipeline criado, mas houve erro ao criar as etapas padrão.' }
  }
}

export async function renomearPipeline(id: string, input: PipelineInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = pipelineSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  try {
    await db
      .update(crmPipelines)
      .set({ nome: parsed.data.nome })
      .where(and(eq(crmPipelines.id, id), eq(crmPipelines.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[renomearPipeline]', e)
    return { error: 'Nao foi possivel renomear o pipeline.' }
  }
}

export async function reordenarPipelines(idsOrdenados: string[]) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // Updates SEQUENCIAIS (pool max=3, max_pipeline=0) — a lista tem poucos itens.
    for (let i = 0; i < idsOrdenados.length; i++) {
      await db
        .update(crmPipelines)
        .set({ ordem: i })
        .where(and(eq(crmPipelines.id, idsOrdenados[i]), eq(crmPipelines.workspaceId, workspace.id)))
    }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[reordenarPipelines]', e)
    return { error: 'Nao foi possivel reordenar os pipelines.' }
  }
}

export async function definirPipelinePadrao(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // Invariante: SEMPRE exatamente 1 pipeline padrão por workspace.
    // 2 updates sequenciais: desmarca todos, marca o escolhido.
    await db
      .update(crmPipelines)
      .set({ padrao: false })
      .where(eq(crmPipelines.workspaceId, workspace.id))

    const [marcado] = await db
      .update(crmPipelines)
      .set({ padrao: true })
      .where(and(eq(crmPipelines.id, id), eq(crmPipelines.workspaceId, workspace.id)))
      .returning({ id: crmPipelines.id })

    if (!marcado) return { error: 'Pipeline nao encontrado.' }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[definirPipelinePadrao]', e)
    return { error: 'Nao foi possivel definir o pipeline padrao.' }
  }
}

export async function excluirPipeline(id: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return { error: 'Apenas administradores podem excluir pipelines.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(eq(crmOportunidades.pipelineId, id))

    if (total > 0) return { error: 'Nao e possivel excluir um pipeline com oportunidades.' }

    await db
      .delete(crmPipelines)
      .where(and(eq(crmPipelines.id, id), eq(crmPipelines.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[excluirPipeline]', e)
    return { error: 'Nao foi possivel excluir o pipeline.' }
  }
}

// --- Etapas ---

export async function criarEtapa(pipelineId: string, input: EtapaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = etapaSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmEtapas)
      .where(eq(crmEtapas.pipelineId, pipelineId))

    const [etapa] = await db
      .insert(crmEtapas)
      .values({
        pipelineId,
        nome: v.nome,
        ordem: total,
        cor: v.cor ?? null,
        probabilidade: v.probabilidade ?? null,
      })
      .returning({ id: crmEtapas.id })

    revalidatePath('/crm')
    return { data: { id: etapa.id } }
  } catch (e) {
    console.error('[criarEtapa]', e)
    return { error: 'Nao foi possivel criar a etapa.' }
  }
}

export async function atualizarEtapa(id: string, input: EtapaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = etapaSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    await db
      .update(crmEtapas)
      .set({
        nome: v.nome,
        cor: v.cor ?? null,
        probabilidade: v.probabilidade ?? null,
      })
      .where(eq(crmEtapas.id, id))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarEtapa]', e)
    return { error: 'Nao foi possivel salvar a etapa.' }
  }
}

export async function reordenarEtapas(pipelineId: string, idsOrdenados: string[]) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    for (let i = 0; i < idsOrdenados.length; i++) {
      await db
        .update(crmEtapas)
        .set({ ordem: i })
        .where(and(eq(crmEtapas.id, idsOrdenados[i]), eq(crmEtapas.pipelineId, pipelineId)))
    }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[reordenarEtapas]', e)
    return { error: 'Nao foi possivel reordenar as etapas.' }
  }
}

export async function excluirEtapa(id: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return { error: 'Apenas administradores podem excluir etapas.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // Conta ANTES para dar mensagem legível — o FK restrict é a trava final.
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(eq(crmOportunidades.etapaId, id))

    if (total > 0) {
      return { error: 'Nao e possivel excluir uma etapa com oportunidades. Mova-as antes.' }
    }

    await db.delete(crmEtapas).where(eq(crmEtapas.id, id))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[excluirEtapa]', e)
    return { error: 'Nao foi possivel excluir a etapa.' }
  }
}

// --- Oportunidades ---

export async function criarOportunidade(input: OportunidadeInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = oportunidadeSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    // Resolve a etapa → pipeline (a etapa manda; evita par etapa/pipeline inconsistente).
    const [etapa] = await db
      .select({ id: crmEtapas.id, pipelineId: crmEtapas.pipelineId })
      .from(crmEtapas)
      .where(eq(crmEtapas.id, v.etapaId))

    if (!etapa) return { error: 'Etapa nao encontrada.' }

    // Nomes livres do dialog: cria empresa/contato mínimos antes, sequencialmente.
    let empresaId = v.empresaId ?? null
    if (!empresaId && v.empresaNome) {
      const [empresa] = await db
        .insert(crmEmpresas)
        .values({ workspaceId: workspace.id, nome: v.empresaNome, donoId: currentUser.id })
        .returning({ id: crmEmpresas.id })
      empresaId = empresa.id
    }

    let contatoId = v.contatoId ?? null
    if (!contatoId && v.contatoNome) {
      const [contato] = await db
        .insert(crmContatos)
        .values({
          workspaceId: workspace.id,
          nome: v.contatoNome,
          empresaId,
          origem: 'manual',
          donoId: currentUser.id,
        })
        .returning({ id: crmContatos.id })
      contatoId = contato.id
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(and(eq(crmOportunidades.etapaId, etapa.id), eq(crmOportunidades.status, 'aberta')))

    const [oportunidade] = await db
      .insert(crmOportunidades)
      .values({
        workspaceId: workspace.id,
        pipelineId: etapa.pipelineId,
        etapaId: etapa.id,
        empresaId,
        contatoId,
        titulo: v.titulo,
        valor: v.valor !== undefined ? String(v.valor) : null,
        tipoReceita: v.tipoReceita,
        origem: v.origem ?? 'manual',
        servicosInteresse: v.servicosInteresse ?? null,
        dataPrevistaFechamento: v.dataPrevistaFechamento ?? null,
        donoId: v.donoId ?? currentUser.id,
        ordemNaEtapa: total,
      })
      .returning({ id: crmOportunidades.id })

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'criacao',
      oportunidadeId: oportunidade.id,
      contatoId,
      empresaId,
      detalhe: v.titulo,
    })

    revalidatePath('/crm')
    return { data: { id: oportunidade.id } }
  } catch (e) {
    console.error('[criarOportunidade]', e)
    return { error: 'Nao foi possivel criar a oportunidade.' }
  }
}

export async function atualizarOportunidade(id: string, input: AtualizarOportunidadeInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = atualizarOportunidadeSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  try {
    const set: Record<string, unknown> = { updatedAt: new Date() }

    if (v.titulo !== undefined) set.titulo = v.titulo
    if (v.valor !== undefined) set.valor = String(v.valor)
    if (v.tipoReceita !== undefined) set.tipoReceita = v.tipoReceita
    if (v.origem !== undefined) set.origem = v.origem
    if (v.servicosInteresse !== undefined) set.servicosInteresse = v.servicosInteresse
    // '' já virou undefined no schema; a chave só existe se veio no input.
    if ('empresaId' in input) set.empresaId = v.empresaId ?? null
    if ('contatoId' in input) set.contatoId = v.contatoId ?? null
    if ('donoId' in input) set.donoId = v.donoId ?? null
    if ('dataPrevistaFechamento' in input) set.dataPrevistaFechamento = v.dataPrevistaFechamento ?? null

    await db
      .update(crmOportunidades)
      .set(set)
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarOportunidade]', e)
    return { error: 'Nao foi possivel salvar a oportunidade.' }
  }
}

export async function deletarOportunidade(id: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return { error: 'Apenas administradores podem excluir oportunidades.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    await db
      .delete(crmOportunidades)
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarOportunidade]', e)
    return { error: 'Nao foi possivel excluir a oportunidade.' }
  }
}

export async function moverOportunidade(id: string, etapaId: string, ordemNaEtapa?: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // Queries SEQUENCIAIS: oportunidade → etapa origem → etapa destino → count → update.
    const [oportunidade] = await db
      .select({ id: crmOportunidades.id, etapaId: crmOportunidades.etapaId })
      .from(crmOportunidades)
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))

    if (!oportunidade) return { error: 'Oportunidade nao encontrada.' }
    if (oportunidade.etapaId === etapaId) return { data: { ok: true } }

    const [etapaDe] = await db
      .select({ nome: crmEtapas.nome })
      .from(crmEtapas)
      .where(eq(crmEtapas.id, oportunidade.etapaId))

    const [etapaPara] = await db
      .select({ nome: crmEtapas.nome, pipelineId: crmEtapas.pipelineId })
      .from(crmEtapas)
      .where(eq(crmEtapas.id, etapaId))

    if (!etapaPara) return { error: 'Etapa de destino nao encontrada.' }

    let ordem = ordemNaEtapa
    if (ordem === undefined) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmOportunidades)
        .where(and(eq(crmOportunidades.etapaId, etapaId), eq(crmOportunidades.status, 'aberta')))
      ordem = total
    }

    await db
      .update(crmOportunidades)
      .set({
        etapaId,
        pipelineId: etapaPara.pipelineId,
        ordemNaEtapa: ordem,
        updatedAt: new Date(),
      })
      .where(eq(crmOportunidades.id, id))

    // Mover de etapa manualmente implica que HOUVE contato com o lead —
    // carimba o 1º contato (idempotente; sem isso, cards em Proposta/
    // Negociação ficavam eternamente "aguardando 1º contato").
    await carimbarPrimeiroContato(id)

    // Entrada no fluxo de follow-up (quick-260719-s3a): mover para a etapa
    // "Follow-up" coloca o card em D1 — SÓ se followup_nivel ainda é null.
    // Voltar para a etapa depois de já ter nível NÃO rebaixa (histórico
    // preservado); sair da etapa/ganhar/perder também não zera nada.
    // try/catch próprio: degradação graciosa enquanto a migration 0037 não
    // for aplicada (colunas ausentes não podem travar o mover).
    if (ehEtapaFollowup(etapaPara.nome)) {
      try {
        await db
          .update(crmOportunidades)
          .set({ followupNivel: 1, ultimoFollowupEm: new Date() })
          .where(
            and(
              eq(crmOportunidades.id, id),
              sql`${crmOportunidades.followupNivel} IS NULL`,
            ),
          )
      } catch (e) {
        console.warn('[moverOportunidade] entrada no follow-up falhou (migration 0037 pendente?)', e)
      }
    }

    // Atividade com de/para = NOMES das etapas (legível na timeline).
    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'mudanca_etapa',
      oportunidadeId: id,
      campo: 'etapa',
      de: etapaDe?.nome ?? null,
      para: etapaPara.nome,
    })

    // GRADUAÇÃO AUTOMÁTICA frio → Vendas (quick-260720-urt, D-01): quando um card
    // do funil "Prospecção Fria" chega em "Qualificado", ele é PROMOVIDO para o
    // pipeline padrão (Vendas) na etapa "Qualificado" — some do board frio e
    // reaparece no Vendas, preservando contato/empresa/valor, SEM UI de arrastar
    // entre pipelines. try/catch próprio: se faltar pipeline padrão / etapa
    // Qualificado no Vendas, a graduação aborta em silêncio (o card fica no frio
    // e o mover NÃO quebra). Queries SEQUENCIAIS (pool max=3, nada de Promise.all).
    try {
      const [pipelineDestino] = await db
        .select({ nome: crmPipelines.nome })
        .from(crmPipelines)
        .where(eq(crmPipelines.id, etapaPara.pipelineId))

      if (
        pipelineDestino &&
        ehPipelineFrio(pipelineDestino.nome) &&
        ehEtapaQualificado(etapaPara.nome)
      ) {
        // Pipeline "Vendas" = o padrão do workspace.
        const [vendas] = await db
          .select({ id: crmPipelines.id })
          .from(crmPipelines)
          .where(and(eq(crmPipelines.workspaceId, workspace.id), eq(crmPipelines.padrao, true)))

        if (vendas) {
          // Etapa "Qualificado" DESSE pipeline padrão (a primeira que casa).
          const etapasVendas = await db
            .select({ id: crmEtapas.id, nome: crmEtapas.nome })
            .from(crmEtapas)
            .where(eq(crmEtapas.pipelineId, vendas.id))
          const qualificadoVendas = etapasVendas.find((e) => ehEtapaQualificado(e.nome))

          if (qualificadoVendas) {
            const [{ total: totalDestino }] = await db
              .select({ total: sql<number>`count(*)::int` })
              .from(crmOportunidades)
              .where(
                and(
                  eq(crmOportunidades.etapaId, qualificadoVendas.id),
                  eq(crmOportunidades.status, 'aberta'),
                ),
              )

            // UM update: troca pipeline/etapa/ordem — contato/empresa/valor ficam
            // na mesma linha, preservados sem tocar.
            await db
              .update(crmOportunidades)
              .set({
                pipelineId: vendas.id,
                etapaId: qualificadoVendas.id,
                ordemNaEtapa: totalDestino,
                updatedAt: new Date(),
              })
              .where(eq(crmOportunidades.id, id))

            await registrarAtividadeCrm(workspace.id, currentUser, {
              tipo: 'mudanca_etapa',
              oportunidadeId: id,
              campo: 'pipeline',
              de: NOME_PIPELINE_FRIO,
              para: 'Vendas · Qualificado',
            })
          }
        }
      }
    } catch (e) {
      console.warn('[moverOportunidade] graduação frio→Vendas falhou (card segue no frio)', e)
    }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[moverOportunidade]', e)
    return { error: 'Nao foi possivel mover a oportunidade.' }
  }
}

/**
 * Avança o follow-up de um card na visão D1..D6 (quick-260719-s3a): arrastar
 * D(n)→D(n+1) = "fiz o follow-up n+1" — incrementa o nível e carimba
 * ultimo_followup_em (zera o relógio do próximo prazo). Card ÚNICO: nada é
 * duplicado, a coluna da visão deriva do nível.
 */
export async function avancarFollowup(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // Queries SEQUENCIAIS: oportunidade → nome da etapa → update.
    const [oportunidade] = await db
      .select({
        id: crmOportunidades.id,
        status: crmOportunidades.status,
        etapaId: crmOportunidades.etapaId,
        followupNivel: crmOportunidades.followupNivel,
      })
      .from(crmOportunidades)
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))

    if (!oportunidade) return { error: 'Oportunidade nao encontrada.' }
    if (oportunidade.status !== 'aberta') {
      return { error: 'So negocios ABERTOS podem avancar no follow-up.' }
    }

    const [etapa] = await db
      .select({ nome: crmEtapas.nome, pipelineId: crmEtapas.pipelineId })
      .from(crmEtapas)
      .where(eq(crmEtapas.id, oportunidade.etapaId))

    if (!etapa) return { error: 'Etapa nao encontrada.' }

    // No Vendas a cadência corre na etapa "Follow-up"; no funil frio ela corre em
    // "Abordado" (não há etapa "Follow-up"). Descobre o pipeline do card para
    // saber qual etapa aceita o avanço. Query sequencial (pool max=3).
    const [pipeline] = await db
      .select({ nome: crmPipelines.nome })
      .from(crmPipelines)
      .where(eq(crmPipelines.id, etapa.pipelineId))
    const frio = ehPipelineFrio(pipeline?.nome ?? null)

    const naEtapaDeCadencia = ehEtapaFollowup(etapa.nome) || (frio && ehEtapaAbordado(etapa.nome))
    if (!naEtapaDeCadencia) {
      return { error: frio ? 'O negocio nao esta na etapa Abordado.' : 'O negocio nao esta na etapa Follow-up.' }
    }

    const nivel = oportunidade.followupNivel

    // No frio, "Abordado" com nível null INICIA a cadência (D1) neste 1º avanço —
    // no Vendas o null→1 acontece ao mover para "Follow-up"; no frio não há esse
    // move, então o início da cadência é aqui.
    if (nivel == null) {
      if (frio && ehEtapaAbordado(etapa.nome)) {
        await db
          .update(crmOportunidades)
          .set({ followupNivel: 1, ultimoFollowupEm: new Date(), updatedAt: new Date() })
          .where(eq(crmOportunidades.id, id))

        await registrarAtividadeCrm(workspace.id, currentUser, {
          tipo: 'followup',
          oportunidadeId: id,
          campo: 'followup',
          de: null,
          para: 'D1',
        })

        revalidatePath('/crm')
        return { data: { nivel: 1 } }
      }
      return { error: 'O negocio ainda nao entrou no fluxo de follow-up.' }
    }
    if (nivel >= 6) return { error: 'O negocio ja esta no ultimo nivel de follow-up (D6).' }

    await db
      .update(crmOportunidades)
      .set({ followupNivel: nivel + 1, ultimoFollowupEm: new Date(), updatedAt: new Date() })
      .where(eq(crmOportunidades.id, id))

    // Timeline: mesmo padrao de 'mudanca_etapa', com de/para legiveis (D2→D3).
    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'followup',
      oportunidadeId: id,
      campo: 'followup',
      de: `D${nivel}`,
      para: `D${nivel + 1}`,
    })

    revalidatePath('/crm')
    return { data: { nivel: nivel + 1 } }
  } catch (e) {
    console.error('[avancarFollowup]', e)
    return { error: 'Nao foi possivel avancar o follow-up. A migration 0037 foi aplicada?' }
  }
}

export async function ganharOportunidade(id: string, opts?: { criarCliente?: boolean }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [oportunidade] = await db
      .select({
        id: crmOportunidades.id,
        titulo: crmOportunidades.titulo,
        empresaId: crmOportunidades.empresaId,
        contatoId: crmOportunidades.contatoId,
      })
      .from(crmOportunidades)
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))

    if (!oportunidade) return { error: 'Oportunidade nao encontrada.' }

    await db
      .update(crmOportunidades)
      .set({ status: 'ganha', ganhaEm: new Date(), updatedAt: new Date() })
      .where(eq(crmOportunidades.id, id))

    let clienteId: string | undefined

    // Conversão opcional em cliente da agência: só quando a oportunidade tem
    // empresa E a empresa ainda não virou cliente.
    if (opts?.criarCliente && oportunidade.empresaId) {
      const [empresa] = await db
        .select({ id: crmEmpresas.id, nome: crmEmpresas.nome, clienteId: crmEmpresas.clienteId })
        .from(crmEmpresas)
        .where(eq(crmEmpresas.id, oportunidade.empresaId))

      if (empresa && !empresa.clienteId) {
        let contato: { nome: string; telefone: string | null; email: string | null } | undefined
        if (oportunidade.contatoId) {
          const [c] = await db
            .select({
              nome: crmContatos.nome,
              telefone: crmContatos.telefone,
              email: crmContatos.email,
            })
            .from(crmContatos)
            .where(eq(crmContatos.id, oportunidade.contatoId))
          contato = c
        }

        const [clienteNovo] = await db
          .insert(clientes)
          .values({
            nome: empresa.nome,
            // Defaults do v1: cliente recém-fechado entra em onboarding; o nicho
            // real é ajustado depois na ficha do cliente.
            status: 'aguardando_inicio',
            nicho: 'negocio_local',
            contatoNome: contato?.nome ?? null,
            contatoTelefone: contato?.telefone ?? null,
            contatoEmail: contato?.email ?? null,
          })
          .returning({ id: clientes.id })

        clienteId = clienteNovo.id

        // Vincula na empresa E na oportunidade (updates sequenciais).
        await db
          .update(crmEmpresas)
          .set({ clienteId, updatedAt: new Date() })
          .where(eq(crmEmpresas.id, empresa.id))

        await db
          .update(crmOportunidades)
          .set({ clienteId, updatedAt: new Date() })
          .where(eq(crmOportunidades.id, id))
      } else if (empresa?.clienteId) {
        // Empresa já é cliente: só vincula o id existente na oportunidade.
        clienteId = empresa.clienteId
        await db
          .update(crmOportunidades)
          .set({ clienteId, updatedAt: new Date() })
          .where(eq(crmOportunidades.id, id))
      }
    }

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'ganho',
      oportunidadeId: id,
      detalhe: clienteId ? 'Cliente criado na carteira' : null,
    })

    revalidatePath('/crm')
    revalidatePath('/clientes')
    return { data: { clienteId } }
  } catch (e) {
    console.error('[ganharOportunidade]', e)
    return { error: 'Nao foi possivel marcar a oportunidade como ganha.' }
  }
}

/**
 * Fase 3 do funil — Ganho → Cliente. Roda DEPOIS do ganho (decisão posterior
 * do dialog): converte o lead da oportunidade GANHA em cliente da agência com
 * status 'aguardando_inicio', reaproveitando nome/telefone/e-mail do contato.
 *
 * Idempotente em 3 níveis (nunca duplica cliente):
 *  (a) oportunidade.clienteId já preenchido → retorna o existente;
 *  (b) contato.clienteId preenchido (o lead já converteu em outro negócio);
 *  (c) empresa.clienteId preenchido (a empresa já é cliente).
 * Em (b)/(c) só VINCULA o id existente onde faltar e retorna jaExistia: true.
 *
 * Fase 4 Parte 1: além do cliente, cria um CONTRATO 'aguardando_dados' com
 * token único (link público /contrato/[token]) usando duração/serviço/
 * mensalidade coletados no dialog. valorMensal alimenta o MRR existente do
 * /financeiro. Degradação graciosa: se a migration 0029 não foi aplicada, a
 * conversão SEGUE sem contrato (contratoToken ausente no retorno).
 */

// quick-260716-ky2: serviços ESTRUTURADOS (checklist + plataformas). O total
// do contrato é a SOMA dos serviços — calculado no servidor, nunca confiado
// ao cliente.
const dadosContratoSchema = z.object({
  duracaoMeses: z.union([z.literal(3), z.literal(6)]),
  servicos: servicosContratadosSchema,
  // quick-260716-sr5: modo de cobrança escolhido na conversão. Default seguro
  // manual_pix — cliente manual NUNCA gera chamada (nem taxa) no Asaas.
  modoCobranca: z.enum(['automatico_asaas', 'manual_pix']).default('manual_pix'),
})

export type DadosContratoConversao = z.infer<typeof dadosContratoSchema>

export async function converterOportunidadeEmCliente(
  oportunidadeId: string,
  dadosContrato: DadosContratoConversao
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsedContrato = dadosContratoSchema.safeParse(dadosContrato)
  if (!parsedContrato.success) return { error: primeiroErro(parsedContrato.error) }

  try {
    const [oportunidade] = await db
      .select({
        id: crmOportunidades.id,
        status: crmOportunidades.status,
        contatoId: crmOportunidades.contatoId,
        empresaId: crmOportunidades.empresaId,
        clienteId: crmOportunidades.clienteId,
      })
      .from(crmOportunidades)
      .where(
        and(
          eq(crmOportunidades.id, oportunidadeId),
          eq(crmOportunidades.workspaceId, workspace.id)
        )
      )

    if (!oportunidade) return { error: 'Oportunidade nao encontrada.' }
    if (oportunidade.status !== 'ganha') {
      return { error: 'So negocios GANHOS podem ser convertidos em cliente.' }
    }

    // (a) a própria oportunidade já converteu.
    if (oportunidade.clienteId) {
      const contratoToken = await criarOuReaproveitarContrato(
        oportunidade.clienteId,
        parsedContrato.data
      )
      return { data: { clienteId: oportunidade.clienteId, jaExistia: true, contratoToken } }
    }

    // Queries SEQUENCIAIS de propósito (pool max=3) — nunca Promise.all.
    let contato:
      | { id: string; nome: string; telefone: string | null; email: string | null; clienteId: string | null }
      | undefined
    if (oportunidade.contatoId) {
      try {
        const [c] = await db
          .select({
            id: crmContatos.id,
            nome: crmContatos.nome,
            telefone: crmContatos.telefone,
            email: crmContatos.email,
            clienteId: crmContatos.clienteId,
          })
          .from(crmContatos)
          .where(eq(crmContatos.id, oportunidade.contatoId))
        contato = c
      } catch (e) {
        // Degradação graciosa: enquanto a migration da coluna cliente_id em
        // crm_contatos não for aplicada, o select acima falha. A conversão
        // segue sem a idempotência POR CONTATO (a por oportunidade/empresa fica).
        console.warn('[converterOportunidadeEmCliente] coluna cliente_id ausente em crm_contatos?', e)
        const [c] = await db
          .select({
            id: crmContatos.id,
            nome: crmContatos.nome,
            telefone: crmContatos.telefone,
            email: crmContatos.email,
          })
          .from(crmContatos)
          .where(eq(crmContatos.id, oportunidade.contatoId))
        contato = c ? { ...c, clienteId: null } : undefined
      }
    }

    let empresa: { id: string; nome: string; clienteId: string | null } | undefined
    if (oportunidade.empresaId) {
      const [e] = await db
        .select({ id: crmEmpresas.id, nome: crmEmpresas.nome, clienteId: crmEmpresas.clienteId })
        .from(crmEmpresas)
        .where(eq(crmEmpresas.id, oportunidade.empresaId))
      empresa = e
    }

    // (b)/(c) contato ou empresa já viraram cliente → só vincular o existente.
    const existente = clienteExistenteDe({ contato, empresa })
    if (existente) {
      await vincularClienteNoFunil(existente, oportunidade.id, contato, empresa)
      await registrarAtividadeCrm(workspace.id, currentUser, {
        tipo: 'ganho',
        oportunidadeId: oportunidade.id,
        detalhe: 'Vinculado a cliente existente da carteira',
      })
      const contratoToken = await criarOuReaproveitarContrato(existente, parsedContrato.data)
      revalidatePath('/crm')
      revalidatePath('/clientes')
      revalidatePath('/contratos')
      return { data: { clienteId: existente, jaExistia: true, contratoToken } }
    }

    // Caso novo: cria o cliente com os dados do lead.
    const payload = dadosClienteDe({ contato, empresa })
    if (!payload) return { error: 'Negocio sem contato e sem empresa — nada para converter.' }

    const [clienteNovo] = await db
      .insert(clientes)
      .values({
        ...payload,
        modoCobranca: parsedContrato.data.modoCobranca,
        // Espelho da flag antiga para não dessincronizar telas legadas.
        usaAsaas: parsedContrato.data.modoCobranca === 'automatico_asaas',
      })
      .returning({ id: clientes.id })

    await vincularClienteNoFunil(clienteNovo.id, oportunidade.id, contato, empresa)

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'ganho',
      oportunidadeId: oportunidade.id,
      detalhe: 'Convertido em cliente da carteira',
    })

    const contratoToken = await criarOuReaproveitarContrato(clienteNovo.id, parsedContrato.data)

    revalidatePath('/crm')
    revalidatePath('/clientes')
    revalidatePath('/contratos')
    return { data: { clienteId: clienteNovo.id, jaExistia: false, contratoToken } }
  } catch (e) {
    console.error('[converterOportunidadeEmCliente]', e)
    return { error: 'Nao foi possivel converter o negocio em cliente.' }
  }
}

/**
 * Cria o contrato 'aguardando_dados' da conversão — ou REAPROVEITA o token se
 * o cliente já tem contrato do fluxo (idempotência: reconverter nunca duplica
 * contrato). Queries SEQUENCIAIS. Degradação graciosa: se as colunas da
 * migration 0029 não existirem ainda, loga console.warn e retorna null — a
 * conversão segue sem contrato (padrão da Fase 3). NÃO exportada.
 */
async function criarOuReaproveitarContrato(
  clienteId: string,
  dados: DadosContratoConversao
): Promise<string | null> {
  try {
    const [existente] = await db
      .select({ token: contratos.token })
      .from(contratos)
      .where(
        and(
          eq(contratos.clienteId, clienteId),
          isNotNull(contratos.token),
          isNotNull(contratos.statusFluxo)
        )
      )
      .orderBy(desc(contratos.createdAt))
      .limit(1)
    if (existente?.token) return existente.token

    // valorMensal = SOMA dos serviços (servidor manda); servico = primeiro
    // serviço marcado (compat legado — telas antigas seguem funcionando).
    const { dataInicio, dataVencimento, valorMensal } = montarDadosContrato({
      duracaoMeses: dados.duracaoMeses,
      mensalidade: somaServicos(dados.servicos),
      hoje: hojeBrasilia(),
    })
    const token = gerarToken()
    const base = {
      clienteId,
      dataInicio,
      dataVencimento,
      valorMensal,
      token,
      statusFluxo: 'aguardando_dados',
      duracaoMeses: dados.duracaoMeses,
      servico: dados.servicos[0].servico,
    }
    try {
      await db.insert(contratos).values({ ...base, servicos: dados.servicos })
    } catch (eServicos) {
      // Migration 0031 pendente (coluna servicos ausente): grava sem a
      // estrutura — o contrato nasce "legado" e pode ser editado depois.
      console.warn('[criarOuReaproveitarContrato] coluna servicos ausente (migration 0031 pendente?)', eServicos)
      await db.insert(contratos).values(base)
    }
    return token
  } catch (e) {
    // Migration 0029 pendente (colunas token/status_fluxo ausentes): a
    // conversão funciona sem contrato; o fluxo chega quando ela for aplicada.
    console.warn('[criarOuReaproveitarContrato] falha ao criar contrato (migration 0029 pendente?)', e)
    return null
  }
}

/**
 * Vincula clienteId na oportunidade, no contato e na empresa (os que existirem
 * e ainda estiverem sem vínculo). Updates SEQUENCIAIS — pool max=3.
 * NÃO exportada: helper interno da conversão.
 */
async function vincularClienteNoFunil(
  clienteId: string,
  oportunidadeId: string,
  contato?: { id: string; clienteId: string | null },
  empresa?: { id: string; clienteId: string | null }
) {
  await db
    .update(crmOportunidades)
    .set({ clienteId, updatedAt: new Date() })
    .where(eq(crmOportunidades.id, oportunidadeId))

  if (contato && !contato.clienteId) {
    try {
      await db
        .update(crmContatos)
        .set({ clienteId, updatedAt: new Date() })
        .where(eq(crmContatos.id, contato.id))
    } catch (e) {
      // Coluna cliente_id ainda não aplicada em produção: loga e segue — a
      // conversão funciona; a idempotência por contato chega com a migration.
      console.warn('[vincularClienteNoFunil] falha ao vincular contato (migration pendente?)', e)
    }
  }

  if (empresa && !empresa.clienteId) {
    await db
      .update(crmEmpresas)
      .set({ clienteId, updatedAt: new Date() })
      .where(eq(crmEmpresas.id, empresa.id))
  }
}

export async function perderOportunidade(id: string, motivoPerda: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const motivo = motivoPerda?.trim()
  if (!motivo) return { error: 'Informe o motivo da perda.' }

  try {
    const [perdida] = await db
      .update(crmOportunidades)
      .set({ status: 'perdida', perdidaEm: new Date(), motivoPerda: motivo, updatedAt: new Date() })
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))
      .returning({ id: crmOportunidades.id })

    if (!perdida) return { error: 'Oportunidade nao encontrada.' }

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'perda',
      oportunidadeId: id,
      detalhe: motivo,
    })

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[perderOportunidade]', e)
    return { error: 'Nao foi possivel marcar a oportunidade como perdida.' }
  }
}

// --- Alvos do drag-and-drop nas colunas VIRTUAIS Ganho/Perdido (D-04) ---
// Wrappers FINOS de propósito: a regra de ganho/perda vive numa única
// implementação (ganhar/perderOportunidade). O board fala em "mover para a
// coluna X"; estes dois traduzem isso para o STATUS da oportunidade — Ganho e
// Perdido NUNCA viram linhas em crm_etapas.

export async function moverParaGanho(id: string, opts?: { criarCliente?: boolean }) {
  return ganharOportunidade(id, opts)
}

export async function moverParaPerdido(id: string, motivo: string) {
  // perderOportunidade já recusa motivo vazio — não duplicar a validação aqui.
  return perderOportunidade(id, motivo)
}

export async function reabrirOportunidade(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [reaberta] = await db
      .update(crmOportunidades)
      .set({
        status: 'aberta',
        ganhaEm: null,
        perdidaEm: null,
        motivoPerda: null,
        updatedAt: new Date(),
      })
      .where(and(eq(crmOportunidades.id, id), eq(crmOportunidades.workspaceId, workspace.id)))
      .returning({ id: crmOportunidades.id })

    if (!reaberta) return { error: 'Oportunidade nao encontrada.' }

    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'reabertura',
      oportunidadeId: id,
    })

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[reabrirOportunidade]', e)
    return { error: 'Nao foi possivel reabrir a oportunidade.' }
  }
}

export async function getAtividadesDaOportunidade(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const atividades = await db
      .select({
        id: crmAtividades.id,
        tipo: crmAtividades.tipo,
        autorNome: crmAtividades.autorNome,
        campo: crmAtividades.campo,
        de: crmAtividades.de,
        para: crmAtividades.para,
        detalhe: crmAtividades.detalhe,
        createdAt: crmAtividades.createdAt,
      })
      .from(crmAtividades)
      .where(
        and(eq(crmAtividades.oportunidadeId, id), eq(crmAtividades.workspaceId, workspace.id))
      )
      .orderBy(desc(crmAtividades.createdAt))
      .limit(50)

    return { data: atividades }
  } catch (e) {
    console.error('[getAtividadesDaOportunidade]', e)
    return { error: 'Nao foi possivel carregar as atividades.' }
  }
}
