'use server'

import { eq, and, gte, sql, desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { inngest } from '@/lib/inngest/client'

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

export async function triggerMetaSync() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  try {
    await inngest.send({ name: 'meta-ads/sync.requested', data: {} })
    return { data: { triggered: true } }
  } catch (err) {
    console.error('[triggerMetaSync] Erro ao disparar sync:', err)
    return { error: 'Nao foi possivel iniciar a sincronizacao. Tente novamente.' }
  }
}

export async function getUltimaSync(): Promise<Date | null> {
  const [result] = await db
    .select({ max: sql<string | null>`max(${campaignInsights.syncedAt})` })
    .from(campaignInsights)

  return result.max ? new Date(result.max) : null
}
