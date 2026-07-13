import { eq, and } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights } from '@/lib/db/schema'
import {
  fetchCampaignInsights,
  fetchAdInsights,
  fetchAdMeta,
  fetchAccountBalance,
} from '@/lib/meta/client'

// Lógica de sincronização Meta compartilhada entre a Route Handler (/api/sync-meta),
// a função Inngest (cron) e chamadas diretas. Sincroniza insights de campanha,
// insights de anúncio (criativos) e o saldo de cada conta.

export async function syncSingleAccount(account: { id: string; metaAccountId: string }): Promise<number> {
  let insightsCount = 0

  // Campaign insights
  const insights = await fetchCampaignInsights(account.metaAccountId)
  for (const insight of insights) {
    const [existing] = await db
      .select({ id: campaignInsights.id })
      .from(campaignInsights)
      .where(
        and(
          eq(campaignInsights.adAccountId, account.id),
          eq(campaignInsights.date, insight.date_start),
          eq(campaignInsights.campaignId, insight.campaign_id),
        ),
      )
      .limit(1)

    const data = {
      campaignName: insight.campaign_name,
      spend: insight.spend,
      impressions: parseInt(insight.impressions, 10),
      clicks: parseInt(insight.clicks, 10),
      reach: parseInt(insight.reach, 10),
      cpc: insight.cpc ?? null,
      cpm: insight.cpm ?? null,
      ctr: insight.ctr ?? null,
      actions: insight.actions.length > 0 ? insight.actions : null,
      actionValues: insight.action_values.length > 0 ? insight.action_values : null,
      syncedAt: new Date(),
    }

    if (existing) {
      await db.update(campaignInsights).set(data).where(eq(campaignInsights.id, existing.id))
    } else {
      await db.insert(campaignInsights).values({
        adAccountId: account.id,
        campaignId: insight.campaign_id,
        date: insight.date_start,
        ...data,
      })
    }
  }
  insightsCount += insights.length

  // Ad insights (criativos) — em paralelo com metadados do anúncio
  try {
    const [ads, adMeta] = await Promise.all([
      fetchAdInsights(account.metaAccountId),
      fetchAdMeta(account.metaAccountId),
    ])

    for (const ad of ads) {
      const [existing] = await db
        .select({ id: adInsights.id })
        .from(adInsights)
        .where(
          and(
            eq(adInsights.adAccountId, account.id),
            eq(adInsights.dateStart, ad.date_start),
            eq(adInsights.adId, ad.ad_id),
          ),
        )
        .limit(1)

      const adData = {
        adName: ad.ad_name,
        adsetId: ad.adset_id || null,
        adsetName: ad.adset_name || null,
        campaignId: ad.campaign_id || null,
        campaignName: ad.campaign_name || null,
        thumbnailUrl: adMeta.get(ad.ad_id)?.thumbnailUrl ?? null,
        effectiveStatus: adMeta.get(ad.ad_id)?.effectiveStatus ?? null,
        spend: ad.spend,
        impressions: parseInt(ad.impressions, 10),
        reach: parseInt(ad.reach ?? '0', 10),
        frequency: ad.frequency ?? null,
        clicks: parseInt(ad.clicks, 10),
        actions: ad.actions.length > 0 ? ad.actions : null,
        actionValues: ad.action_values.length > 0 ? ad.action_values : null,
        dateStop: ad.date_stop,
        syncedAt: new Date(),
      }

      if (existing) {
        await db.update(adInsights).set(adData).where(eq(adInsights.id, existing.id))
      } else {
        await db.insert(adInsights).values({
          adAccountId: account.id,
          adId: ad.ad_id,
          dateStart: ad.date_start,
          ...adData,
        })
      }
    }
  } catch (err) {
    console.warn(`[sync-meta] Erro ad_insights ${account.metaAccountId}:`, err)
  }

  // Saldo
  try {
    const saldo = await fetchAccountBalance(account.metaAccountId)
    if (saldo !== null) {
      await db
        .update(adAccounts)
        .set({ saldo: saldo.toFixed(2), updatedAt: new Date() })
        .where(eq(adAccounts.id, account.id))
    }
  } catch {
    // ignorar erro de saldo
  }

  return insightsCount
}

/**
 * Sincroniza TODAS as contas Meta ativas (ou só as de um cliente, se `clienteId`).
 * Processa sequencialmente para respeitar os limites da API da Meta.
 * Nunca lança por conta individual — registra e segue.
 */
export async function sincronizarContasMeta(
  clienteId?: string | null,
): Promise<{ contas: number; insights: number }> {
  const conditions = [
    eq(adAccounts.ativo, true),
    eq(adAccounts.plataforma, 'meta'),
  ]
  if (clienteId) {
    conditions.push(eq(adAccounts.clienteId, clienteId))
  }

  const accountsToSync = await db
    .select({ id: adAccounts.id, metaAccountId: adAccounts.metaAccountId })
    .from(adAccounts)
    .where(and(...conditions))

  let totalInsights = 0
  for (const account of accountsToSync) {
    try {
      totalInsights += await syncSingleAccount(account)
    } catch (err) {
      console.warn(`[sync-meta] Erro conta ${account.metaAccountId}:`, err)
    }
  }

  return { contas: accountsToSync.length, insights: totalInsights }
}
