'use server'

import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { crmTags } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
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
