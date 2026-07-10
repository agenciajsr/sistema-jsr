import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = {
  id: string
  email: string | undefined
  nome: string
  role: 'admin' | 'membro'
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  })
  if (!profile) return null

  return {
    id: user.id,
    email: user.email,
    nome: profile.nome,
    role: profile.role,
  }
}

export async function requireAdmin(): Promise<
  { user: CurrentUser } | { error: string }
> {
  const current = await getCurrentUser()
  if (!current || current.role !== 'admin') {
    return { error: 'Apenas administradores podem executar esta ação.' as const }
  }
  return { user: current }
}
