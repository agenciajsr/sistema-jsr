import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { googleCredentials } from '@/lib/db/schema'

import { refreshAccessToken } from './oauth'

// Acesso à linha ÚNICA de credenciais do Google (app single-tenant).
// Toda a lógica de refresh automático do access_token vive aqui.

export type GoogleCredentialsRow = typeof googleCredentials.$inferSelect

// Buffer de segurança: renova o token 60s antes de expirar para evitar
// corridas com chamadas que estejam prestes a sair.
const BUFFER_EXPIRACAO_MS = 60 * 1000

/** Retorna a única linha de credenciais, ou null se não houver conexão. */
export async function getCredentials(): Promise<GoogleCredentialsRow | null> {
  const [row] = await db.select().from(googleCredentials).limit(1)
  return row ?? null
}

/** true quando existe uma conta Google conectada. */
export async function isConnected(): Promise<boolean> {
  return (await getCredentials()) !== null
}

type SaveInput = {
  email?: string
  accessToken: string
  refreshToken: string
  scope?: string
  expiresIn: number // segundos até o access_token expirar
}

/**
 * Grava as credenciais garantindo UMA única linha: apaga tudo e insere.
 * expiry = agora + expiresIn segundos.
 */
export async function saveCredentials(input: SaveInput): Promise<void> {
  const expiry = new Date(Date.now() + input.expiresIn * 1000)
  await db.delete(googleCredentials)
  await db.insert(googleCredentials).values({
    email: input.email ?? null,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    scope: input.scope ?? null,
    expiry,
  })
}

/** Remove todas as credenciais (desconexão). */
export async function deleteCredentials(): Promise<void> {
  await db.delete(googleCredentials)
}

/**
 * Retorna um access_token VÁLIDO, renovando automaticamente quando necessário.
 * - Sem credenciais → null.
 * - access_token ainda válido (com buffer) → retorna o atual.
 * - Expirado → renova via refresh_token, persiste o novo token/expiry e retorna.
 * Preserva o refresh_token antigo quando a resposta de refresh não trouxer um novo.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const row = await getCredentials()
  if (!row) return null

  const agora = Date.now()
  const expiraEm = row.expiry ? row.expiry.getTime() : 0
  if (row.accessToken && expiraEm - BUFFER_EXPIRACAO_MS > agora) {
    return row.accessToken
  }

  // Precisa renovar.
  const tokens = await refreshAccessToken(row.refreshToken)
  const novoExpiry = new Date(Date.now() + tokens.expires_in * 1000)

  await db
    .update(googleCredentials)
    .set({
      accessToken: tokens.access_token,
      // Google normalmente NÃO devolve um novo refresh_token — preservar o atual.
      refreshToken: tokens.refresh_token ?? row.refreshToken,
      expiry: novoExpiry,
      scope: tokens.scope ?? row.scope,
      updatedAt: new Date(),
    })
    .where(eq(googleCredentials.id, row.id))

  return tokens.access_token
}
