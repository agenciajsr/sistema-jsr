import { cache } from 'react'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { withRetry } from '@/lib/utils/with-retry'

// Tetos da revalidação de sessão (auth.getUser + profiles.findFirst).
// 1ª tentativa curta (5s) para falhar RÁPIDO quando o pool da instância está
// entupido; retry com 8s (o teto antigo). Se as DUAS falharem, propagamos o
// erro (tratado pelo error boundary) em vez de virar null → redirect para
// /login com usuário logado (evita loop e não expõe rota logada).
const SESSAO_TIMEOUT_MS = 5_000
const SESSAO_RETRY_TIMEOUT_MS = 8_000

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

    // Factory da revalidação completa (auth + profile), no mesmo padrão do
    // /financeiro: cada tentativa do withRetry redispara tudo do zero.
    //
    // Fail-fast continua valendo: numa conexão "morta" do pooler (Supavisor),
    // a query de profile pode congelar para sempre (o statement_timeout não
    // dispara em socket morto). Sem teto, a função inteira trava até o
    // maxDuration — a causa nº1 dos 504 em TODAS as páginas (getCurrentUser
    // roda no layout de todas).
    //
    // Por que RETRY aqui: na cascata de 15/jul/2026, o /financeiro entupia o
    // pool da instância (queries abandonadas da 1ª tentativa do withRetry) e a
    // sessão de TODAS as páginas caía na 1ª tentativa — com Supabase Auth e o
    // banco saudáveis por fora. A 2ª tentativa costuma passar (pool já
    // liberado/quente). Curto-circuitos de "não logado"/"sem profile" retornam
    // null SEM gastar retry (deslogado não é erro).
    const revalidarSessao = async (): Promise<CurrentUser | null> => {
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

    // Lança SÓ quando as duas tentativas falham — o erro sobe para o error
    // boundary (recarregar resolve), nunca vira redirect indevido para /login.
    return withRetry(revalidarSessao, {
      timeoutMs: SESSAO_TIMEOUT_MS,
      retryTimeoutMs: SESSAO_RETRY_TIMEOUT_MS,
      label: 'sessao',
    })
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
