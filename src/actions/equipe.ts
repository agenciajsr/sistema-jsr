'use server'

import { createClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'

export type Membro = {
  id: string
  nome: string
  role: 'admin' | 'membro'
  email: string | null
}

// Client admin da Supabase (chave secreta, apenas servidor). Mesmo padrão de
// src/actions/usuarios.ts. Usado para ler o e-mail (que vive em auth.users, não
// em profiles) e para remover usuários.
function criarSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!, // apenas servidor, nunca expor
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Lista todos os membros da equipe: nome + cargo vêm de `profiles`; o e-mail é
 * casado por id contra a Supabase Admin API (auth.users). Qualquer usuário
 * logado pode ver a lista.
 */
export async function listarMembros(): Promise<
  { data: Membro[] } | { error: string }
> {
  const current = await getCurrentUser()
  if (!current) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const perfis = await db
    .select({ id: profiles.id, nome: profiles.nome, role: profiles.role })
    .from(profiles)
    .orderBy(profiles.nome)

  // Mapa id -> email a partir da Admin API. Se falhar, seguimos sem e-mail em
  // vez de derrubar a tela inteira.
  const emailPorId = new Map<string, string | null>()
  try {
    const supabaseAdmin = criarSupabaseAdmin()
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of data?.users ?? []) {
      emailPorId.set(u.id, u.email ?? null)
    }
  } catch {
    // segue sem e-mails
  }

  const membros: Membro[] = perfis.map((p) => ({
    id: p.id,
    nome: p.nome,
    role: p.role,
    email: emailPorId.get(p.id) ?? null,
  }))

  return { data: membros }
}

/**
 * Remove um membro: apaga da Supabase Auth (deleteUser) e de `profiles`.
 * Protegido por requireAdmin. O admin não pode remover a si mesmo.
 */
export async function removerMembro(
  id: string
): Promise<{ data: { id: string } } | { error: string }> {
  const admin = await requireAdmin()
  if ('error' in admin) {
    return { error: admin.error }
  }

  if (admin.user.id === id) {
    return { error: 'Você não pode remover a si mesmo.' }
  }

  const supabaseAdmin = criarSupabaseAdmin()
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) {
    return { error: 'Não foi possível remover o membro. Tente novamente.' }
  }

  try {
    await db.delete(profiles).where(eq(profiles.id, id))
  } catch {
    return { error: 'Membro removido do acesso, mas houve falha ao limpar o perfil.' }
  }

  revalidatePath('/equipe')
  return { data: { id } }
}
