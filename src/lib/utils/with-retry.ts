// Helper de retry automático para cargas que sofrem com soluços do pooler.
//
// Contexto: quando o pooler do Supabase (Supavisor) soluça no cold start,
// a 1ª tentativa estoura o teto e falha — mas o F5 manual sempre resolvia,
// porque a 2ª tentativa reaproveita as conexões já abertas/quentes do pool.
// withRetry é exatamente esse "F5 automático" no lado do servidor: falha
// rápido na 1ª tentativa, espera um instante e tenta UMA vez mais antes de
// desistir de vez.
//
// Observação: withTimeout não cancela a promise original — as queries da 1ª
// tentativa que estouraram o teto continuam rodando em background. Isso é
// aceitável aqui (são só selects) e é justamente o que deixa as conexões
// quentes para a 2ª tentativa.

import { withTimeout } from './with-timeout'

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    /** Teto (ms) da 1ª tentativa. */
    timeoutMs: number
    /** Teto (ms) da 2ª tentativa (retry). Default: timeoutMs. */
    retryTimeoutMs?: number
    /** Espera (ms) entre as tentativas. Default: 500. */
    delayMs?: number
    /** Rótulo para o TimeoutError. */
    label?: string
  },
): Promise<T> {
  const { timeoutMs, retryTimeoutMs, delayMs = 500, label = 'operação' } = opts

  try {
    // 1ª tentativa: teto mais curto para falhar rápido no soluço do pooler.
    return await withTimeout(fn(), timeoutMs, label)
  } catch {
    // Espera um instante para o pooler se recompor antes de tentar de novo.
    await new Promise((resolve) => setTimeout(resolve, delayMs))

    // 2ª (e última) tentativa: fn() dispara as queries do ZERO — por isso
    // recebemos uma factory, e não uma Promise pronta. Se falhar de novo,
    // o erro propaga para o chamador decidir (tela de erro como último recurso).
    return await withTimeout(fn(), retryTimeoutMs ?? timeoutMs, `${label} (retry)`)
  }
}
