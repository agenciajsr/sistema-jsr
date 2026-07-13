import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { exchangeCode, fetchUserEmail } from '@/lib/google/oauth'
import { saveCredentials } from '@/lib/google/credentials'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/integrations/google/callback
// Recebe o retorno do Google, valida o state (CSRF), troca o code por tokens
// e grava as credenciais. Em qualquer erro, volta para /integracoes com feedback.
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const erro = url.searchParams.get('error')

  // Função utilitária para redirecionar limpando o cookie de state.
  const redirecionar = (destino: string) => {
    const res = NextResponse.redirect(new URL(destino, request.url))
    res.cookies.delete('google_oauth_state')
    return res
  }

  if (erro) {
    return redirecionar('/integracoes?erro=acesso_negado')
  }

  // CSRF: o state da query tem que bater com o cookie que gravamos no /start.
  const cookieState = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('google_oauth_state='))
    ?.split('=')[1]

  if (!state || !cookieState || state !== cookieState) {
    return redirecionar('/integracoes?erro=state_invalido')
  }

  if (!code) {
    return redirecionar('/integracoes?erro=falha_conexao')
  }

  try {
    const tokens = await exchangeCode(code)
    // O refresh_token é indispensável; sem ele não conseguimos renovar depois.
    if (!tokens.refresh_token) {
      return redirecionar('/integracoes?erro=falha_conexao')
    }
    const email = await fetchUserEmail(tokens.access_token)
    await saveCredentials({
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      expiresIn: tokens.expires_in,
    })
    return redirecionar('/integracoes?conectado=1')
  } catch (e) {
    console.error('[google/callback] Falha ao conectar conta Google:', e)
    return redirecionar('/integracoes?erro=falha_conexao')
  }
}
