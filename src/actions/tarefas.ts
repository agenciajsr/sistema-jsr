'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { tarefas, tarefaChecklistItems } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { hojeBrasilia } from '@/lib/date-br'
import {
  tarefaSchema,
  atualizarTarefaSchema,
  recorrenciaSchema,
  type TarefaInput,
  type AtualizarTarefaInput,
  type RecorrenciaInput,
} from '@/lib/validations/tarefa'

// Padrão do repo: toda action devolve { data } | { error } e começa pelo
// getCurrentUser(). Mutação termina em revalidatePath('/tarefas').
//
// ⚠️ QUERIES SEQUENCIAIS (nada de paralelizar com Promise): pool max=3 com
// max_pipeline=0 — ver o comentário longo em src/lib/db/index.ts.

/** Traduz o erro do Zod na primeira mensagem legível. */
function primeiroErro(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? 'Dados invalidos.'
}

export async function criarTarefa(input: TarefaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const parsed = tarefaSchema.safeParse({ ...input, data: input.data || hojeBrasilia() })
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  const ehRecorrente = v.recorrencia !== 'nenhuma'

  if (v.recorrencia === 'personalizada' && (v.recorrenciaDias ?? []).length === 0) {
    return { error: 'Escolha ao menos um dia da semana para a recorrencia personalizada.' }
  }

  try {
    // Recorrente ⇒ nasce o MOLDE (nunca aparece na lista). NÃO materializamos
    // aqui: o próximo getTarefasDoDia faz isso e é o ÚNICO caminho de
    // materialização — uma fonte de verdade só (D-05).
    const [criada] = await db
      .insert(tarefas)
      .values({
        titulo: v.titulo,
        notas: v.notas || null,
        descricao: v.descricao || null,
        data: v.data,
        dataInicio: v.dataInicio ?? null,
        clienteId: v.clienteId ?? null,
        responsavelId: v.responsavelId ?? null,
        prioridade: v.prioridade,
        tempoEstimado: v.tempoEstimado || null,
        etiquetas: v.etiquetas ?? [],
        recorrencia: v.recorrencia,
        recorrenciaDias: v.recorrencia === 'personalizada' ? (v.recorrenciaDias ?? []) : null,
        ehMolde: ehRecorrente,
        ativa: true,
        // O "+ Adicionar tarefa" da coluna já nasce no status dela.
        status: v.status,
        // ⚠️ `codigo`/`codigoNum` NÃO entram aqui: são gerados pelo banco (D-04).
      })
      .returning({ id: tarefas.id })

    const itens = (v.checklist ?? []).filter((i) => i.texto.trim().length > 0)
    if (itens.length > 0) {
      // Na recorrente os itens moram no MOLDE e são copiados para cada ocorrência.
      // A `ordem` é contada DENTRO do grupo (D-08).
      const ordemPorGrupo = new Map<string, number>()
      await db.insert(tarefaChecklistItems).values(
        itens.map((item) => {
          const grupo = item.grupo?.trim() || 'Checklist'
          const ordem = ordemPorGrupo.get(grupo) ?? 0
          ordemPorGrupo.set(grupo, ordem + 1)
          return { tarefaId: criada.id, texto: item.texto.trim(), ordem, grupo }
        })
      )
    }

    revalidatePath('/tarefas')
    return { data: { id: criada.id } }
  } catch (e) {
    console.error('[criarTarefa]', e)
    return { error: 'Nao foi possivel criar a tarefa.' }
  }
}

export async function atualizarTarefa(id: string, campos: AtualizarTarefaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const parsed = atualizarTarefaSchema.safeParse(campos)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data

  try {
    const set: Record<string, unknown> = { updatedAt: new Date() }

    if (v.titulo !== undefined) set.titulo = v.titulo
    if (v.notas !== undefined) set.notas = v.notas || null
    if (v.descricao !== undefined) set.descricao = v.descricao || null
    if (v.data !== undefined) set.data = v.data
    if (v.prioridade !== undefined) set.prioridade = v.prioridade
    if (v.etiquetas !== undefined) set.etiquetas = v.etiquetas
    if (v.tempoEstimado !== undefined) set.tempoEstimado = v.tempoEstimado || null
    // '' já virou undefined no schema; a chave só existe se veio no input.
    if ('clienteId' in campos) set.clienteId = v.clienteId ?? null
    if ('responsavelId' in campos) set.responsavelId = v.responsavelId ?? null
    if ('dataInicio' in campos) set.dataInicio = v.dataInicio ?? null

    if (v.status !== undefined) {
      set.status = v.status
      // concluidaEm acompanha o status: marca ao concluir, limpa ao reabrir.
      set.concluidaEm = v.status === 'concluida' ? new Date() : null
    }

    await db.update(tarefas).set(set).where(eq(tarefas.id, id))

    revalidatePath('/tarefas')
    // Sem isto a página de detalhe serve dado velho depois de salvar.
    revalidatePath(`/tarefas/${id}`)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[atualizarTarefa]', e)
    return { error: 'Nao foi possivel salvar a tarefa.' }
  }
}

export async function atualizarRecorrencia(id: string, input: RecorrenciaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const parsed = recorrenciaSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  if (v.recorrencia === 'personalizada' && (v.recorrenciaDias ?? []).length === 0) {
    return { error: 'Escolha ao menos um dia da semana para a recorrencia personalizada.' }
  }

  try {
    // Editar a recorrência de uma OCORRÊNCIA é editar a regra da SÉRIE:
    // resolvemos o alvo para o molde (a regra vive só lá — D-04).
    const [atual] = await db
      .select({ tarefaMaeId: tarefas.tarefaMaeId, ehMolde: tarefas.ehMolde })
      .from(tarefas)
      .where(eq(tarefas.id, id))

    if (!atual) return { error: 'Tarefa nao encontrada.' }

    const alvo = atual.tarefaMaeId ?? id

    await db
      .update(tarefas)
      .set({
        recorrencia: v.recorrencia,
        recorrenciaDias: v.recorrencia === 'personalizada' ? (v.recorrenciaDias ?? []) : null,
        // Uma avulsa que vira recorrente precisa virar MOLDE, senão nunca
        // materializa (getTarefasDoDia só olha para eh_molde = true).
        ehMolde: v.recorrencia !== 'nenhuma',
        ...(v.ativa !== undefined ? { ativa: v.ativa } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tarefas.id, alvo))

    revalidatePath('/tarefas')
    revalidatePath(`/tarefas/${id}`)
    return { data: { ok: true, alvo } }
  } catch (e) {
    console.error('[atualizarRecorrencia]', e)
    return { error: 'Nao foi possivel salvar a recorrencia.' }
  }
}

export async function addChecklistItemTarefa(
  tarefaId: string,
  texto: string,
  grupo: string = 'Checklist'
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const limpo = texto.trim()
  if (!limpo) return { error: 'Informe o item do checklist.' }

  const grupoLimpo = grupo.trim() || 'Checklist'

  try {
    // D-08: a ordem é contada DENTRO do grupo, não na tarefa inteira.
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(tarefaChecklistItems)
      .where(
        and(eq(tarefaChecklistItems.tarefaId, tarefaId), eq(tarefaChecklistItems.grupo, grupoLimpo))
      )

    const [item] = await db
      .insert(tarefaChecklistItems)
      .values({ tarefaId, texto: limpo, ordem: total, grupo: grupoLimpo })
      .returning({ id: tarefaChecklistItems.id })

    revalidatePath('/tarefas')
    revalidatePath(`/tarefas/${tarefaId}`)
    return { data: { id: item.id } }
  } catch (e) {
    console.error('[addChecklistItemTarefa]', e)
    return { error: 'Nao foi possivel adicionar o item.' }
  }
}

export async function toggleChecklistItemTarefa(id: string, concluido: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    // O returning devolve a tarefa dona — sem ela não dá para revalidar o detalhe.
    const [item] = await db
      .update(tarefaChecklistItems)
      .set({ concluido })
      .where(eq(tarefaChecklistItems.id, id))
      .returning({ tarefaId: tarefaChecklistItems.tarefaId })

    revalidatePath('/tarefas')
    if (item) revalidatePath(`/tarefas/${item.tarefaId}`)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[toggleChecklistItemTarefa]', e)
    return { error: 'Nao foi possivel atualizar o item.' }
  }
}

export async function deleteChecklistItemTarefa(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const [item] = await db
      .delete(tarefaChecklistItems)
      .where(eq(tarefaChecklistItems.id, id))
      .returning({ tarefaId: tarefaChecklistItems.tarefaId })

    revalidatePath('/tarefas')
    if (item) revalidatePath(`/tarefas/${item.tarefaId}`)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deleteChecklistItemTarefa]', e)
    return { error: 'Nao foi possivel remover o item.' }
  }
}

export async function deletarTarefa(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    // O onDelete: 'cascade' do tarefa_mae_id apaga a série inteira ao apagar o
    // molde; os itens de checklist também caem por cascade.
    await db.delete(tarefas).where(eq(tarefas.id, id))

    revalidatePath('/tarefas')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarTarefa]', e)
    return { error: 'Nao foi possivel excluir a tarefa.' }
  }
}

/** Itens do checklist de UMA tarefa — usado pelo sheet ao abrir a edição. */
export async function getChecklistDaTarefa(tarefaId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const itens = await db
      .select({
        id: tarefaChecklistItems.id,
        texto: tarefaChecklistItems.texto,
        concluido: tarefaChecklistItems.concluido,
        ordem: tarefaChecklistItems.ordem,
        grupo: tarefaChecklistItems.grupo,
      })
      .from(tarefaChecklistItems)
      .where(eq(tarefaChecklistItems.tarefaId, tarefaId))
      .orderBy(tarefaChecklistItems.grupo, tarefaChecklistItems.ordem)

    return { data: itens }
  } catch (e) {
    console.error('[getChecklistDaTarefa]', e)
    return { error: 'Nao foi possivel carregar o checklist.' }
  }
}
