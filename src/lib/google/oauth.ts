import {
  googleTokenResponseSchema,
  googleUserinfoSchema,
  type GoogleTokenResponse,
} from './schemas'

// Helpers puros do fluxo OAuth 2.0 do Google (sem acesso a DB).
// Seguem o mesmo padrão do client da Meta: getEnv em PT, fetch direto, Zod na resposta.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo'

// Escopo mínimo para ler e gravar eventos na agenda do usuário.
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Variavel de ambiente ${key} nao configurada. Verifique o .env.local.`)
  return val
}

/** URL de callback do OAuth. Em dev cai no localhost quando NEXT_PUBLIC_APP_URL ausente. */
export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/api/integrations/google/callback`
}

/**
 * Monta a URL da tela de consentimento do Google.
 * access_type=offline + prompt=consent GARANTEM o retorno de um refresh_token
 * (sem isso o Google só devolve refresh_token na primeira autorização de sempre).
 */
export function buildAuthUrl(state: string): string {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)
  return url.toString()
}

/** Troca o authorization code por tokens (access + refresh). */
export async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(),
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
    throw new Error(`[Google OAuth] Falha ao trocar o code (${res.status}): ${texto}`)
  }

  return googleTokenResponseSchema.parse(await res.json())
}

/**
 * Renova o access_token a partir do refresh_token.
 * A resposta pode NÃO trazer refresh_token — o chamador deve preservar o antigo.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const clientId = getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`[Google OAuth] Falha ao renovar o token (${res.status}): ${texto}`)
  }

  return googleTokenResponseSchema.parse(await res.json())
}

/** Revoga um token no Google. Best-effort — NUNCA lança. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    // Revogar é best-effort; se falhar, a linha já será apagada localmente.
  }
}

/** Descobre o e-mail da conta conectada (best-effort). Retorna undefined em erro. */
export async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return undefined
    const parsed = googleUserinfoSchema.parse(await res.json())
    return parsed.email
  } catch {
    return undefined
  }
}
