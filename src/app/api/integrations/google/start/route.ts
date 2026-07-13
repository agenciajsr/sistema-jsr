import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { buildAuthUrl } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/integrations/google/start
// Inicia o fluxo OAuth: gera um state (proteção CSRF), guarda em cookie httpOnly
// e redireciona para a tela de consentimento do Google.
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(buildAuthUrl(state))
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutos para concluir o consentimento
  })
  return res
}
