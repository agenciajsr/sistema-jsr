'use server'

import { and, desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import {
  clientes,
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

    // Atividade com de/para = NOMES das etapas (legível na timeline).
    await registrarAtividadeCrm(workspace.id, currentUser, {
      tipo: 'mudanca_etapa',
      oportunidadeId: id,
      campo: 'etapa',
      de: etapaDe?.nome ?? null,
      para: etapaPara.nome,
    })

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[moverOportunidade]', e)
    return { error: 'Nao foi possivel mover a oportunidade.' }
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
