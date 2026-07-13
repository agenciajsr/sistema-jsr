// Helper de fail-fast para chamadas de rede que podem pendurar.
//
// Contexto: durante um soluço/incidente do Supabase, supabase.auth.getUser()
// (e queries de DB) podem ficar pendentes indefinidamente. Sem um teto curto,
// a função serverless da Vercel roda os 300s inteiros ate ser morta (timeout).
// withTimeout transforma esse congelamento num erro rapido e recuperavel.

export class TimeoutError extends Error {
  constructor(label = 'operação') {
    super(`Timeout excedido em ${label}`)
    this.name = 'TimeoutError'
  }
}

/**
 * Corre `promise` contra um teto de tempo. Se estourar, rejeita com TimeoutError.
 * A promise original continua rodando em background (nao ha cancelamento real),
 * mas o chamador para de esperar e segue rapido.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operação'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}
