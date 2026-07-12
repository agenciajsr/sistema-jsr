'use server'

import { eq, and, gte, sql, desc, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'

export type TrafegoCampanha = {
  campaignId: string
  campaignName: string
  date: string
  spend: string
  impressions: number
  clicks: number
  reach: number
  cpc: string | null
  cpm: string | null
  ctr: string | null
  actions: unknown
}

export type TrafegoAccount = {
  id: string
  metaAccountId: string
  nome: string
  clienteNome: string | null
  accountStatus: number | null
  currency: string | null
  campanhas: TrafegoCampanha[]
  spendTotal: number
  ultimaSync: Date | null
}

export async function getTrafegoData(): Promise<TrafegoAccount[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  // Data de 7 dias atras
  const hoje = new Date()
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
  const dataMinima = seteDiasAtras.toISOString().slice(0, 10)

  // Buscar contas ativas da Meta
  const contas = await db
    .select({
      id: adAccounts.id,
      metaAccountId: adAccounts.metaAccountId,
      nome: adAccounts.nome,
      accountStatus: adAccounts.accountStatus,
      currency: adAccounts.currency,
      clienteNome: clientes.nome,
    })
    .from(adAccounts)
    .leftJoin(clientes, eq(adAccounts.clienteId, clientes.id))
    .where(and(eq(adAccounts.plataforma, 'meta'), eq(adAccounts.ativo, true)))
    .orderBy(adAccounts.nome)

  const result: TrafegoAccount[] = []

  for (const conta of contas) {
    // Buscar insights dos ultimos 7 dias
    const insights = await db
      .select({
        campaignId: campaignInsights.campaignId,
        campaignName: campaignInsights.campaignName,
        date: campaignInsights.date,
        spend: campaignInsights.spend,
        impressions: campaignInsights.impressions,
        clicks: campaignInsights.clicks,
        reach: campaignInsights.reach,
        cpc: campaignInsights.cpc,
        cpm: campaignInsights.cpm,
        ctr: campaignInsights.ctr,
        actions: campaignInsights.actions,
        syncedAt: campaignInsights.syncedAt,
      })
      .from(campaignInsights)
      .where(
        and(
          eq(campaignInsights.adAccountId, conta.id),
          gte(campaignInsights.date, dataMinima),
        ),
      )
      .orderBy(desc(campaignInsights.date))

    const spendTotal = insights.reduce((acc, i) => acc + Number(i.spend), 0)
    const ultimaSync = insights.length > 0
      ? insights.reduce((latest, i) => (i.syncedAt > latest ? i.syncedAt : latest), insights[0].syncedAt)
      : null

    result.push({
      id: conta.id,
      metaAccountId: conta.metaAccountId,
      nome: conta.nome,
      clienteNome: conta.clienteNome,
      accountStatus: conta.accountStatus,
      currency: conta.currency,
      campanhas: insights.map((i) => ({
        campaignId: i.campaignId,
        campaignName: i.campaignName,
        date: i.date,
        spend: i.spend,
        impressions: i.impressions ?? 0,
        clicks: i.clicks ?? 0,
        reach: i.reach ?? 0,
        cpc: i.cpc,
        cpm: i.cpm,
        ctr: i.ctr,
        actions: i.actions,
      })),
      spendTotal,
      ultimaSync,
    })
  }

  return result
}

export async function triggerMetaSync(clienteId?: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const params = clienteId ? `?clienteId=${clienteId}` : ''

  // Fire-and-forget: dispara sync via API route sem aguardar
  fetch(`${baseUrl}/api/sync-meta${params}`, { method: 'POST' }).catch(() => {})
  return { data: { triggered: true } }
}

export async function getUltimaSync(): Promise<Date | null> {
  const [result] = await db
    .select({ max: sql<string | null>`max(${campaignInsights.syncedAt})` })
    .from(campaignInsights)

  return result.max ? new Date(result.max) : null
}

export type ContaNaoVinculada = {
  id: string
  nome: string
  metaAccountId: string
  accountStatus: number | null
}

/**
 * Contas Meta ativas ainda sem cliente vinculado (cliente_id NULL).
 */
export async function getContasNaoVinculadas(): Promise<ContaNaoVinculada[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      metaAccountId: adAccounts.metaAccountId,
      accountStatus: adAccounts.accountStatus,
    })
    .from(adAccounts)
    .where(
      and(
        isNull(adAccounts.clienteId),
        eq(adAccounts.plataforma, 'meta'),
        eq(adAccounts.ativo, true),
      ),
    )
    .orderBy(adAccounts.nome)
}

export type ContaDoCliente = {
  id: string
  nome: string
  metaAccountId: string
  plataforma: 'meta' | 'google'
  accountStatus: number | null
  ativo: boolean
}

/**
 * Todas as contas de anuncio (qualquer plataforma) vinculadas a um cliente.
 */
export async function getContasDoCliente(clienteId: string): Promise<ContaDoCliente[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      metaAccountId: adAccounts.metaAccountId,
      plataforma: adAccounts.plataforma,
      accountStatus: adAccounts.accountStatus,
      ativo: adAccounts.ativo,
    })
    .from(adAccounts)
    .where(eq(adAccounts.clienteId, clienteId))
    .orderBy(adAccounts.nome)
}

/**
 * Clientes ativos (id, nome) para popular selects de vinculo.
 */
export async function listarClientes(): Promise<{ id: string; nome: string }[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .where(eq(clientes.status, 'ativo'))
    .orderBy(clientes.nome)
}

/**
 * Vincula (ou desvincula, com clienteId null) uma conta de anuncio a um cliente.
 * Protegido por sessao. Revalida /campanhas para a conta sumir da secao "nao vinculadas".
 */
export async function vincularContaAoCliente(
  adAccountId: string,
  clienteId: string | null,
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  try {
    await db
      .update(adAccounts)
      .set({ clienteId, updatedAt: new Date() })
      .where(eq(adAccounts.id, adAccountId))

    revalidatePath('/campanhas')
    if (clienteId) {
      revalidatePath(`/clientes/${clienteId}`)
    }
    return { data: { ok: true } }
  } catch (err) {
    console.error('[vincularContaAoCliente] Erro ao vincular conta:', err)
    return { error: 'Nao foi possivel vincular a conta. Tente novamente.' }
  }
}
