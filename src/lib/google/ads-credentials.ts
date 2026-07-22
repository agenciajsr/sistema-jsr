import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { googleAdsCredentials } from '@/lib/db/schema'

import { refreshAccessToken } from './oauth'

// Acesso à linha ÚNICA de credenciais do Google Ads (app single-tenant).
// Espelha lib/google/credentials.ts, mas sobre a tabela google_ads_credentials —
// separação total do fluxo da Agenda. O refresh reusa o helper de oauth.ts.

export type GoogleAdsCredentialsRow = typeof googleAdsCredentials.$inferSelect

const BUFFER_EXPIRACAO_MS = 60 * 1000

/** Retorna a única linha de credenciais do Google Ads, ou null. */
export async function getAdsCredentials(): Promise<GoogleAdsCredentialsRow | null> {
  const [row] = await db.select().from(googleAdsCredentials).limit(1)
  return row ?? null
}

/** true quando o Google Ads está conectado. */
export async function isAdsConnected(): Promise<boolean> {
  return (await getAdsCredentials()) !== null
}

type SaveInput = {
  email?: string
  accessToken: string
  refreshToken: string
  scope?: string
  expiresIn: number
}

/** Grava as credenciais garantindo UMA única linha: apaga tudo e insere. */
export async function saveAdsCredentials(input: SaveInput): Promise<void> {
  const expiry = new Date(Date.now() + input.expiresIn * 1000)
  await db.delete(googleAdsCredentials)
  await db.insert(googleAdsCredentials).values({
    email: input.email ?? null,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    scope: input.scope ?? null,
    expiry,
  })
}

/** Remove as credenciais do Google Ads (desconexão). */
export async function deleteAdsCredentials(): Promise<void> {
  await db.delete(googleAdsCredentials)
}

/**
 * access_token VÁLIDO do Google Ads, renovando quando necessário (mesma lógica
 * de credentials.ts). Retorna null sem credenciais. Usado pelo sync (Parte 2).
 */
export async function getValidAdsAccessToken(): Promise<string | null> {
  const row = await getAdsCredentials()
  if (!row) return null

  const agora = Date.now()
  const expiraEm = row.expiry ? row.expiry.getTime() : 0
  if (row.accessToken && expiraEm - BUFFER_EXPIRACAO_MS > agora) {
    return row.accessToken
  }

  const tokens = await refreshAccessToken(row.refreshToken)
  const novoExpiry = new Date(Date.now() + tokens.expires_in * 1000)

  await db
    .update(googleAdsCredentials)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? row.refreshToken,
      expiry: novoExpiry,
      scope: tokens.scope ?? row.scope,
      updatedAt: new Date(),
    })
    .where(eq(googleAdsCredentials.id, row.id))

  return tokens.access_token
}
