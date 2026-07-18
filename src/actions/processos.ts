'use server'

// Actions dos PROCESSOS do cliente (Onboarding + Retenção/Gestão de crise).
// Padrão do repo: { data } | { error }, getCurrentUser() no topo, queries
// sequenciais, revalidatePath ao mutar.

import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { clientes, processoModeloItens } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { gerarProcessoParaCliente, type TipoProcesso } from '@/lib/processos/gerar'
import { toggleChecklistItemTarefa } from '@/actions/tarefas'

function revalidarFicha(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/clientes')
}

/** Gera o checklist do processo a partir do modelo (idempotente). */
export async function gerarChecklistProcesso(clienteId: string, tipo: TipoProcesso) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const criados = await gerarProcessoParaCliente(clienteId, tipo)
  if (criados === 0) return { error: 'Tarefa do processo ja existe ou o modelo esta vazio.' }

  revalidarFicha(clienteId)
  return { data: { criados } }
}

/**
 * (gp5): alterna um item do checklist da TAREFA do processo. Wrapper fino
 * sobre a action de tarefas (fonte única) que também revalida a ficha do
 * cliente — a action original só revalida /tarefas.
 */
export async function alternarItemProcesso(itemId: string, concluido: boolean, clienteId: string) {
  const r = await toggleChecklistItemTarefa(itemId, concluido)
  if (!('error' in r) || !r.error) revalidarFicha(clienteId)
  return r
}

// --- Modelo editável ---

export async function listarModeloProcesso(tipo: TipoProcesso) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const itens = await db
      .select({
        id: processoModeloItens.id,
        titulo: processoModeloItens.titulo,
        ordem: processoModeloItens.ordem,
        opcional: processoModeloItens.opcional,
        ativo: processoModeloItens.ativo,
      })
      .from(processoModeloItens)
      .where(eq(processoModeloItens.tipo, tipo))
      .orderBy(asc(processoModeloItens.ordem))
    return { data: itens }
  } catch (e) {
    console.error('[listarModeloProcesso]', e)
    return { error: 'Nao foi possivel carregar o modelo.' }
  }
}

export async function criarModeloItem(tipo: TipoProcesso, titulo: string, opcional: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }
  const limpo = titulo.trim()
  if (!limpo) return { error: 'Informe o titulo do item.' }

  try {
    const [{ maxOrdem }] = await db
      .select({ maxOrdem: sql<number>`coalesce(max(${processoModeloItens.ordem}), -1)::int` })
      .from(processoModeloItens)
      .where(eq(processoModeloItens.tipo, tipo))

    const [novo] = await db
      .insert(processoModeloItens)
      .values({ tipo, titulo: limpo, opcional, ordem: maxOrdem + 1 })
      .returning({ id: processoModeloItens.id })
    return { data: { id: novo.id } }
  } catch (e) {
    console.error('[criarModeloItem]', e)
    return { error: 'Nao foi possivel criar o item do modelo.' }
  }
}

export async function atualizarModeloItem(
  itemId: string,
  campos: { titulo?: string; opcional?: boolean; ativo?: boolean },
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }
  if (campos.titulo !== undefined && !campos.titulo.trim()) {
    return { error: 'O titulo nao pode ficar vazio.' }
  }

  try {
    const [salvo] = await db
      .update(processoModeloItens)
      .set({
        ...(campos.titulo !== undefined ? { titulo: campos.titulo.trim() } : {}),
        ...(campos.opcional !== undefined ? { opcional: campos.opcional } : {}),
        ...(campos.ativo !== undefined ? { ativo: campos.ativo } : {}),
        updatedAt: new Date(),
      })
      .where(eq(processoModeloItens.id, itemId))
      .returning({ id: processoModeloItens.id })
    if (!salvo) return { error: 'Item do modelo nao encontrado.' }
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarModeloItem]', e)
    return { error: 'Nao foi possivel atualizar o item do modelo.' }
  }
}

export async function excluirModeloItem(itemId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    await db.delete(processoModeloItens).where(eq(processoModeloItens.id, itemId))
    return { data: { ok: true } }
  } catch (e) {
    console.error('[excluirModeloItem]', e)
    return { error: 'Nao foi possivel excluir o item do modelo.' }
  }
}

// --- Gestão de crise (atenção/churn) ---

/**
 * Coloca o cliente em atenção (status em_aviso + motivo) e gera o checklist
 * de retenção a partir do modelo (idempotente).
 */
export async function colocarClienteEmAtencao(clienteId: string, motivo: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }
  const limpo = motivo.trim()
  if (!limpo) return { error: 'Informe o motivo da atencao.' }

  try {
    const [salvo] = await db
      .update(clientes)
      .set({ status: 'em_aviso', motivoAtencao: limpo, updatedAt: new Date() })
      .where(eq(clientes.id, clienteId))
      .returning({ id: clientes.id })
    if (!salvo) return { error: 'Cliente nao encontrado.' }

    await gerarProcessoParaCliente(clienteId, 'retencao')

    revalidarFicha(clienteId)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[colocarClienteEmAtencao]', e)
    return { error: 'Nao foi possivel colocar o cliente em atencao.' }
  }
}

/**
 * Tira o cliente da atenção (volta a ativo, limpa o motivo). O checklist de
 * retenção fica como HISTÓRICO — é apagado para permitir nova crise futura
 * nascer limpa do modelo? Não: mantemos os itens; nova crise reaproveita o
 * checklist existente (o usuário pode reabrir itens na mão).
 */
export async function removerClienteDaAtencao(clienteId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const [salvo] = await db
      .update(clientes)
      .set({ status: 'ativo', motivoAtencao: null, updatedAt: new Date() })
      .where(and(eq(clientes.id, clienteId), eq(clientes.status, 'em_aviso')))
      .returning({ id: clientes.id })
    if (!salvo) return { error: 'Cliente nao esta em atencao.' }

    revalidarFicha(clienteId)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[removerClienteDaAtencao]', e)
    return { error: 'Nao foi possivel remover a atencao.' }
  }
}
