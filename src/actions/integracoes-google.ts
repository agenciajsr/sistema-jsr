'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth/session'
import { getCredentials, deleteCredentials } from '@/lib/google/credentials'
import { revokeToken } from '@/lib/google/oauth'

type Resultado = { ok: true } | { error: string }

/**
 * Desconecta a conta Google: revoga o refresh_token no Google (best-effort)
 * e apaga a linha de credenciais. Nunca lança para o client.
 */
export async function desconectarGoogle(): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada. Faça login novamente.' }

  try {
    const cred = await getCredentials()
    if (cred?.refreshToken) {
      // Revogar é best-effort — revokeToken já engole erros internamente.
      await revokeToken(cred.refreshToken)
    }
    await deleteCredentials()
    revalidatePath('/integracoes')
    revalidatePath('/painel')
    revalidatePath('/agenda')
    return { ok: true }
  } catch (e) {
    console.error('[desconectarGoogle] Falha ao desconectar:', e)
    return { error: 'Não foi possível desconectar. Tente novamente.' }
  }
}
