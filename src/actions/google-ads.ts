'use server'

import { getCurrentUser } from '@/lib/auth/session'
import { isAdsConnected } from '@/lib/google/ads-credentials'
import { adsSyncConfigurado, listarContasDaMcc, type ContaGoogleAds } from '@/lib/google/ads-client'

type Resultado =
  | { ok: true; contas: ContaGoogleAds[] }
  | { error: string }

/**
 * "Testar conexão" do Google Ads: lista as contas da MCC (prova token + OAuth +
 * MCC de ponta a ponta). Mensagens claras para cada pré-requisito faltando.
 */
export async function testarConexaoGoogleAds(): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada. Faça login novamente.' }

  if (!(await isAdsConnected())) {
    return { error: 'Conecte o Google Ads primeiro (botão Conectar acima).' }
  }
  if (!adsSyncConfigurado()) {
    return {
      error:
        'Faltam as variáveis GOOGLE_ADS_DEVELOPER_TOKEN e GOOGLE_ADS_LOGIN_CUSTOMER_ID no ambiente.',
    }
  }

  try {
    const contas = await listarContasDaMcc()
    return { ok: true, contas }
  } catch (e) {
    console.error('[testarConexaoGoogleAds]', e)
    return {
      error:
        'Não foi possível consultar a MCC. Verifique o developer token e o ID da MCC, e tente de novo.',
    }
  }
}
