import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { exchangeAdsCode } from '@/lib/google/ads-oauth'
import { fetchUserEmail } from '@/lib/google/oauth'
import { saveAdsCredentials } from '@/lib/google/ads-credentials'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/integrations/google-ads/callback
// Retorno do consentimento do Google Ads: valida o state (CSRF), troca o code por
// tokens e grava as credenciais do Ads. Erros voltam para /integracoes com feedback.
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const erro = url.searchParams.get('error')

  const redirecionar = (destino: string) => {
    const res = NextResponse.redirect(new URL(destino, request.url))
    res.cookies.delete('google_ads_oauth_state')
    return res
  }

  if (erro) {
    return redirecionar('/integracoes?ads_erro=acesso_negado')
  }

  const cookieState = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('google_ads_oauth_state='))
    ?.split('=')[1]

  if (!state || !cookieState || state !== cookieState) {
    return redirecionar('/integracoes?ads_erro=state_invalido')
  }

  if (!code) {
    return redirecionar('/integracoes?ads_erro=falha_conexao')
  }

  try {
    const tokens = await exchangeAdsCode(code)
    // Sem refresh_token não conseguimos renovar depois — aborta.
    if (!tokens.refresh_token) {
      return redirecionar('/integracoes?ads_erro=falha_conexao')
    }
    const email = await fetchUserEmail(tokens.access_token)
    await saveAdsCredentials({
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      expiresIn: tokens.expires_in,
    })
    return redirecionar('/integracoes?ads_conectado=1')
  } catch (e) {
    console.error('[google-ads/callback] Falha ao conectar:', e)
    return redirecionar('/integracoes?ads_erro=falha_conexao')
  }
}
