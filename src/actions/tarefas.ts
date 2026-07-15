'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import {
  tarefas,
  tarefaChecklistItems,
  tarefaComentarios,
  tarefaAnexos,
  tarefaAtividades,
} from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { uploadFile, getSignedUrl, deleteFile } from '@/lib/storage/client'
import { hojeBrasilia } from '@/lib/date-br'
import {
  tarefaSchema,
  atualizarTarefaSchema,
  recorrenciaSchema,
  comentarioSchema,
  type TarefaInput,
  type AtualizarTarefaInput,
  type RecorrenciaInput,
  type ComentarioInput,
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

type EntradaAtividade = {
  tipo: string
  campo?: string
  de?: string | null
  para?: string | null
  detalhe?: string | null
}

/**
 * Grava uma linha no histórico da tarefa. NÃO é action (helper interno).
 * ⚠️ O log de atividade NUNCA pode derrubar a mutação que ele registra — nem
 * quando a 0017 ainda não foi aplicada. Por isso o try/catch só loga.
 */
async function registrarAtividade(
  tarefaId: string,
  autor: { id: string; nome: string },
  entrada: EntradaAtividade
) {
  try {
    await db.insert(tarefaAtividades).values({
      tarefaId,
      autorId: autor.id,
      autorNome: autor.nome,
      tipo: entrada.tipo,
      campo: entrada.campo ?? null,
      de: entrada.de ?? null,
      para: entrada.para ?? null,
      detalhe: entrada.detalhe ?? null,
    })
  } catch (e) {
    console.error('[registrarAtividade]', e)
  }
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
    // aqui: o próximo getTarefasDoPeriodo faz isso e é o ÚNICO caminho de
    // materialização — uma fonte de verdade só (D-05).
    const [criada] = await db
      .insert(tarefas)
      .values({
        titulo: v.titulo,
        subtitulo: v.subtitulo || null,
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

    await registrarAtividade(criada.id, currentUser, { tipo: 'criou' })

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
    if (v.subtitulo !== undefined) set.subtitulo = v.subtitulo || null
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

    // D-08: pin é preferência de visualização — set direto, sem log.
    if (v.fixada !== undefined) set.fixada = v.fixada

    // D-09: lê a linha ATUAL antes do update, para registrar de/para por campo.
    // 1 query sequencial a mais (nada de paralelizar com Promise).
    const [atual] = await db
      .select({
        titulo: tarefas.titulo,
        status: tarefas.status,
        prioridade: tarefas.prioridade,
        responsavelId: tarefas.responsavelId,
        clienteId: tarefas.clienteId,
        data: tarefas.data,
        dataInicio: tarefas.dataInicio,
        tempoEstimado: tarefas.tempoEstimado,
      })
      .from(tarefas)
      .where(eq(tarefas.id, id))

    await db.update(tarefas).set(set).where(eq(tarefas.id, id))

    // Uma linha de atividade por campo que REALMENTE mudou. Campo inalterado
    // não vira linha. `fixada` não entra aqui de propósito.
    if (atual) {
      const rastreados = [
        'titulo',
        'status',
        'prioridade',
        'responsavelId',
        'clienteId',
        'data',
        'dataInicio',
        'tempoEstimado',
      ] as const
      for (const campo of rastreados) {
        if (!(campo in set)) continue
        const antigo = (atual as Record<string, unknown>)[campo]
        const de = antigo == null ? null : String(antigo)
        const para = set[campo] == null ? null : String(set[campo])
        if (de !== para) {
          await registrarAtividade(id, currentUser, { tipo: 'campo_alterado', campo, de, para })
        }
      }
    }

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
        // materializa (getTarefasDoPeriodo só olha para eh_molde = true).
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
      .returning({ tarefaId: tarefaChecklistItems.tarefaId, texto: tarefaChecklistItems.texto })

    if (item) {
      await registrarAtividade(item.tarefaId, currentUser, {
        tipo: concluido ? 'checklist_concluido' : 'checklist_reaberto',
        detalhe: item.texto,
      })
      revalidatePath(`/tarefas/${item.tarefaId}`)
    }
    revalidatePath('/tarefas')
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

// --- Comentários, anexos, atividade (so8) ---

export async function criarComentario(tarefaId: string, input: ComentarioInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const parsed = comentarioSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  try {
    const [comentario] = await db
      .insert(tarefaComentarios)
      .values({
        tarefaId,
        autorId: currentUser.id,
        autorNome: currentUser.nome,
        texto: parsed.data.texto,
      })
      .returning({ id: tarefaComentarios.id })

    await registrarAtividade(tarefaId, currentUser, {
      tipo: 'comentou',
      detalhe: parsed.data.texto.slice(0, 120),
    })

    revalidatePath('/tarefas')
    revalidatePath(`/tarefas/${tarefaId}`)
    return { data: { id: comentario.id } }
  } catch (e) {
    console.error('[criarComentario]', e)
    return { error: 'Nao foi possivel salvar o comentario.' }
  }
}

export async function deletarComentario(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const [comentario] = await db
      .select({ tarefaId: tarefaComentarios.tarefaId, autorId: tarefaComentarios.autorId })
      .from(tarefaComentarios)
      .where(eq(tarefaComentarios.id, id))

    if (!comentario) return { error: 'Comentario nao encontrado.' }

    // Só o autor OU um admin exclui — senão a action recusa (o botão de excluir
    // só é renderizado para o autor, mas a regra vive aqui, no servidor).
    if (comentario.autorId !== currentUser.id && currentUser.role !== 'admin') {
      return { error: 'Voce so pode excluir os seus proprios comentarios.' }
    }

    await db.delete(tarefaComentarios).where(eq(tarefaComentarios.id, id))

    revalidatePath('/tarefas')
    revalidatePath(`/tarefas/${comentario.tarefaId}`)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarComentario]', e)
    return { error: 'Nao foi possivel excluir o comentario.' }
  }
}

const MAX_ANEXO_BYTES = 50 * 1024 * 1024 // 50 MB — mesmo teto dos documentos.

export async function uploadAnexoTarefa(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const file = formData.get('file') as File | null
  const tarefaId = formData.get('tarefaId') as string | null

  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' }
  if (file.size > MAX_ANEXO_BYTES) return { error: 'Arquivo muito grande. Maximo permitido: 50 MB.' }
  if (!tarefaId) return { error: 'Tarefa nao informada.' }

  try {
    // D-04: bucket `documentos`, prefixo `tarefas/{id}/`. Zero setup novo.
    const up = await uploadFile(file, `tarefas/${tarefaId}`)
    if ('error' in up) return { error: up.error }

    const [anexo] = await db
      .insert(tarefaAnexos)
      .values({
        tarefaId,
        nome: file.name,
        tamanhoBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        storagePath: up.path,
        uploadPorId: currentUser.id,
        uploadPorNome: currentUser.nome,
      })
      .returning({ id: tarefaAnexos.id })

    await registrarAtividade(tarefaId, currentUser, { tipo: 'anexou', detalhe: file.name })

    revalidatePath('/tarefas')
    revalidatePath(`/tarefas/${tarefaId}`)
    return { data: { id: anexo.id } }
  } catch (e) {
    console.error('[uploadAnexoTarefa]', e)
    return { error: 'Nao foi possivel enviar o arquivo.' }
  }
}

export async function deletarAnexoTarefa(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const [anexo] = await db
      .select({
        tarefaId: tarefaAnexos.tarefaId,
        storagePath: tarefaAnexos.storagePath,
        nome: tarefaAnexos.nome,
      })
      .from(tarefaAnexos)
      .where(eq(tarefaAnexos.id, id))

    if (!anexo) return { error: 'Anexo nao encontrado.' }

    // Falha do storage só loga e não bloqueia (mesmo precedente de deletarDocumento).
    const del = await deleteFile(anexo.storagePath)
    if ('error' in del) console.error('[deletarAnexoTarefa] storage:', del.error)

    await db.delete(tarefaAnexos).where(eq(tarefaAnexos.id, id))

    await registrarAtividade(anexo.tarefaId, currentUser, {
      tipo: 'removeu_anexo',
      detalhe: anexo.nome,
    })

    revalidatePath('/tarefas')
    revalidatePath(`/tarefas/${anexo.tarefaId}`)
    return { data: { ok: true } }
  } catch (e) {
    console.error('[deletarAnexoTarefa]', e)
    return { error: 'Nao foi possivel remover o anexo.' }
  }
}

export async function getUrlAnexoTarefa(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  try {
    const [anexo] = await db
      .select({ storagePath: tarefaAnexos.storagePath })
      .from(tarefaAnexos)
      .where(eq(tarefaAnexos.id, id))

    if (!anexo) return { error: 'Anexo nao encontrado.' }

    const r = await getSignedUrl(anexo.storagePath)
    if ('error' in r) return { error: r.error }
    return { data: { url: r.url } }
  } catch (e) {
    console.error('[getUrlAnexoTarefa]', e)
    return { error: 'Nao foi possivel gerar o link de download.' }
  }
}
