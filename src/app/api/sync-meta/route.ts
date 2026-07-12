import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights } from '@/lib/db/schema'
import {
  fetchMetaAdAccounts,
  fetchCampaignInsights,
  fetchAdInsights,
  fetchAdThumbnails,
  fetchAccountBalance,
} from '@/lib/meta/client'

export const maxDuration = 120 // até 2 minutos

async function syncSingleAccount(account: { id: string; metaAccountId: string }) {
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

  // Ad insights (criativos) — em paralelo com thumbnails
  try {
    const [ads, thumbs] = await Promise.all([
      fetchAdInsights(account.metaAccountId),
      fetchAdThumbnails(account.metaAccountId),
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
        thumbnailUrl: thumbs.get(ad.ad_id) ?? null,
        spend: ad.spend,
        impressions: parseInt(ad.impressions, 10),
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

export async function POST(request: NextRequest) {
  const clienteId = request.nextUrl.searchParams.get('clienteId')

  try {
    // Buscar contas a sincronizar: apenas do cliente específico, ou todas ativas se não informado
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

    if (accountsToSync.length === 0) {
      return NextResponse.json({ ok: true, contas: 0, insights: 0 })
    }

    // Processar contas sequencialmente para respeitar rate limits da Meta
    let totalInsights = 0
    for (const account of accountsToSync) {
      try {
        const count = await syncSingleAccount(account)
        totalInsights += count
      } catch (err) {
        console.warn(`[sync-meta] Erro conta ${account.metaAccountId}:`, err)
      }
    }

    return NextResponse.json({ ok: true, contas: accountsToSync.length, insights: totalInsights })
  } catch (err) {
    console.error('[sync-meta] Erro geral:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
