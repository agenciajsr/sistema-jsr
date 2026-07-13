import { cache } from 'react'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { withTimeout } from '@/lib/utils/with-timeout'

// Teto para a revalidação de sessão contra o Supabase. Se estourar, propagamos
// o erro (tratado pelo error.tsx do grupo (app)) em vez de virar null → redirect
// para /login com usuário logado (evita loop e não expõe rota logada).
const AUTH_TIMEOUT_MS = 8_000

export type CurrentUser = {
  id: string
  email: string | undefined
  nome: string
  role: 'admin' | 'membro'
}

// Memoizado com React cache(): dedupe dentro do MESMO render de requisição.
// Sem isto, uma única carga de página (ex.: /financeiro) dispara ~6 chamadas
// independentes de supabase.auth.getUser() — 1 no layout + 1 por server action
// no Promise.all — e cada getUser() é um round-trip de rede que revalida a
// sessão contra o servidor Supabase. Colapsar para 1 por request corta a
// amplificação de latência que estourava o timeout serverless (504) em cold start.
// cache() é por-request: NÃO afeta server actions mutativas (rodam em requests
// separadas) nem vaza sessão entre usuários.
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const supabase = await createClient()
    // Fail-fast: se o Supabase Auth pendurar (soluço/incidente), o withTimeout
    // rejeita em 8s e o erro sobe para o error.tsx do grupo (app), em vez de a
    // função serverless congelar ate os 300s da Vercel.
    const {
      data: { user },
    } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS, 'auth.getUser')
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
)

export async function requireAdmin(): Promise<
  { user: CurrentUser } | { error: string }
> {
  const current = await getCurrentUser()
  if (!current || current.role !== 'admin') {
    return { error: 'Apenas administradores podem executar esta ação.' as const }
  }
  return { user: current }
}
