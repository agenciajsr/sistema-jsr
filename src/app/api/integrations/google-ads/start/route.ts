import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { buildAdsAuthUrl } from '@/lib/google/ads-oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/integrations/google-ads/start
// Inicia o OAuth do Google Ads (escopo adwords). State em cookie httpOnly PRÓPRIO
// (google_ads_oauth_state) — não colide com o da Agenda.
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(buildAdsAuthUrl(state))
  res.cookies.set('google_ads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
