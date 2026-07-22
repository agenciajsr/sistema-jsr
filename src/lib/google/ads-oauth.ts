import { googleTokenResponseSchema, type GoogleTokenResponse } from './schemas'

// Fluxo OAuth do GOOGLE ADS — separado do da Agenda (oauth.ts). Mesmo app
// (GOOGLE_CLIENT_ID/SECRET) e endpoints, mas escopo `adwords` e redirect próprio
// (/api/integrations/google-ads/callback). O refresh é redirect-independente, então
// reusa refreshAccessToken de oauth.ts.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

// Escopo de leitura/gestão do Google Ads. Só LEMOS (relatórios), mas o Google
// não expõe um escopo read-only separado — `adwords` é o escopo único da API.
export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'

function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Variavel de ambiente ${key} nao configurada. Verifique o .env.local.`)
  return val
}

/** Redirect do OAuth do Google Ads (distinto do da Agenda). */
export function getAdsRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/api/integrations/google-ads/callback`
}

/**
 * URL da tela de consentimento para o Google Ads.
 * access_type=offline + prompt=consent garantem o refresh_token.
 */
export function buildAdsAuthUrl(state: string): string {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getAdsRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_ADS_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)
  return url.toString()
}

/** Troca o authorization code por tokens (usando o redirect do Ads). */
export async function exchangeAdsCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getAdsRedirectUri(),
    grant_type: 'authorization_code',
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`[Google Ads OAuth] Falha ao trocar o code (${res.status}): ${texto}`)
  }

  return googleTokenResponseSchema.parse(await res.json())
}
