'use server'

import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { crmContatos, crmContatoTags, crmTags } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { registrarAtividadeCrm } from '@/lib/crm/atividades'
import { CORES_TAG } from '@/lib/crm/tags'
import { tagSchema, type TagInput } from '@/lib/validations/crm'

// Tags do CRM (modal "Criar novo Lead"). Padrão do repo: { data } | { error },
// getCurrentUser() + getWorkspaceAtual() no topo, queries SEQUENCIAIS
// (pool max=3), revalidatePath('/crm') ao mutar.

/** Traduz o erro do Zod na primeira mensagem legível (copiado, não importado —
 * exportar helper de arquivo 'use server' criaria endpoint público). */
function primeiroErro(e: { issues: { message: string }[] }): string {
  return e.issues[0]?.message ?? 'Dados invalidos.'
}

/** Todas as tags do workspace, em ordem alfabética — alimenta o seletor. */
export async function listarTags() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const tags = await db
      .select({ id: crmTags.id, nome: crmTags.nome, cor: crmTags.cor })
      .from(crmTags)
      .where(eq(crmTags.workspaceId, workspace.id))
      .orderBy(asc(crmTags.nome))

    return { data: tags }
  } catch (e) {
    console.error('[listarTags]', e)
    return { error: 'Nao foi possivel carregar as tags.' }
  }
}

/**
 * Cria uma tag no workspace. Nome com trim, duplicada (case-insensitive) é
 * recusada ANTES do insert; a cor precisa ser uma chave da paleta CORES_TAG.
 */
export async function criarTag(input: TagInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) return { error: primeiroErro(parsed.error) }

  const v = parsed.data
  if (!(v.cor in CORES_TAG)) return { error: 'Cor de tag invalida.' }

  try {
    const [duplicada] = await db
      .select({ id: crmTags.id })
      .from(crmTags)
      .where(
        and(
          eq(crmTags.workspaceId, workspace.id),
          sql`lower(${crmTags.nome}) = lower(${v.nome})`
        )
      )
      .limit(1)

    if (duplicada) return { error: `A tag "${v.nome}" ja existe.` }

    const [tag] = await db
      .insert(crmTags)
      .values({ workspaceId: workspace.id, nome: v.nome, cor: v.cor })
      .returning({ id: crmTags.id, nome: crmTags.nome, cor: crmTags.cor })

    revalidatePath('/crm')
    return { data: tag }
  } catch (e) {
    console.error('[criarTag]', e)
    return { error: 'Nao foi possivel criar a tag.' }
  }
}

/**
 * Vincula uma tag ao lead (badge "+" da ficha) e registra 'tag_adicionada' no
 * histórico. Idempotente: o índice único + onConflictDoNothing fazem o vínculo
 * repetido virar no-op (e sem evento duplicado — returning só traz inseridos).
 */
export async function vincularTagLead(contatoId: string, tagId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    // Guarda de workspace: o contato precisa ser DESTE workspace.
    const [contato] = await db
      .select({ id: crmContatos.id })
      .from(crmContatos)
      .where(and(eq(crmContatos.id, contatoId), eq(crmContatos.workspaceId, workspace.id)))
      .limit(1)
    if (!contato) return { error: 'Lead nao encontrado.' }

    const [tag] = await db
      .select({ id: crmTags.id, nome: crmTags.nome, cor: crmTags.cor })
      .from(crmTags)
      .where(and(eq(crmTags.id, tagId), eq(crmTags.workspaceId, workspace.id)))
      .limit(1)
    if (!tag) return { error: 'Tag nao encontrada.' }

    const inseridas = await db
      .insert(crmContatoTags)
      .values({ contatoId, tagId })
      .onConflictDoNothing()
      .returning({ id: crmContatoTags.id })

    if (inseridas.length > 0) {
      await registrarAtividadeCrm(workspace.id, currentUser, {
        tipo: 'tag_adicionada',
        contatoId,
        detalhe: tag.nome,
      })
    }

    revalidatePath('/crm')
    return { data: tag }
  } catch (e) {
    console.error('[vincularTagLead]', e)
    return { error: 'Nao foi possivel adicionar a tag.' }
  }
}

/** Desvincula uma tag do lead e registra 'tag_removida' no histórico. */
export async function desvincularTagLead(contatoId: string, tagId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessao expirada. Faca login novamente.' }

  const workspace = await getWorkspaceAtual()
  if (!workspace) return { error: 'Workspace nao encontrado. Aplique a migration 0019.' }

  try {
    const [tag] = await db
      .select({ id: crmTags.id, nome: crmTags.nome })
      .from(crmTags)
      .where(and(eq(crmTags.id, tagId), eq(crmTags.workspaceId, workspace.id)))
      .limit(1)
    if (!tag) return { error: 'Tag nao encontrada.' }

    const removidas = await db
      .delete(crmContatoTags)
      .where(and(eq(crmContatoTags.contatoId, contatoId), eq(crmContatoTags.tagId, tagId)))
      .returning({ id: crmContatoTags.id })

    if (removidas.length > 0) {
      await registrarAtividadeCrm(workspace.id, currentUser, {
        tipo: 'tag_removida',
        contatoId,
        detalhe: tag.nome,
      })
    }

    revalidatePath('/crm')
    return { data: { ok: true } }
  } catch (e) {
    console.error('[desvincularTagLead]', e)
    return { error: 'Nao foi possivel remover a tag.' }
  }
}
