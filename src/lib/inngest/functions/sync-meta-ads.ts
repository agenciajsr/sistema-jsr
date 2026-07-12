import { eq, and } from 'drizzle-orm'

import { inngest } from '../client'
import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights } from '@/lib/db/schema'
import { fetchMetaAdAccounts, fetchCampaignInsights, fetchAdInsights, fetchAdThumbnails, fetchAccountBalance } from '@/lib/meta/client'

export const syncMetaAds = inngest.createFunction(
  {
    id: 'sync-meta-ads',
    name: 'Sincronizar Meta Ads',
    triggers: [
      { cron: '0 6 * * *' },
      { event: 'meta-ads/sync.requested' },
    ],
  },
  async ({ step }: { step: any }) => {
    // Step 1: Sincronizar contas de anuncio
    const accounts = await step.run('sync-ad-accounts', async () => {
      const metaAccounts = await fetchMetaAdAccounts()

      for (const acc of metaAccounts) {
        // Remover prefixo "act_" do id
        const numericId = acc.id.replace(/^act_/, '')

        // Verificar se ja existe
        const [existing] = await db
          .select({ id: adAccounts.id })
          .from(adAccounts)
          .where(eq(adAccounts.metaAccountId, numericId))
          .limit(1)

        if (existing) {
          await db
            .update(adAccounts)
            .set({
              nome: acc.name,
              accountStatus: acc.account_status,
              currency: acc.currency,
              updatedAt: new Date(),
            })
            .where(eq(adAccounts.id, existing.id))
        } else {
          await db.insert(adAccounts).values({
            plataforma: 'meta',
            metaAccountId: numericId,
            nome: acc.name,
            accountStatus: acc.account_status,
            currency: acc.currency,
          })
        }
      }

      return metaAccounts.length
    })

    // Step 2: Para cada conta ativa, sincronizar insights
    const activeAccounts = await step.run('list-active-accounts', async () => {
      const rows = await db
        .select({ id: adAccounts.id, metaAccountId: adAccounts.metaAccountId })
        .from(adAccounts)
        .where(and(eq(adAccounts.ativo, true), eq(adAccounts.plataforma, 'meta')))
      return rows
    })

    let synced = 0
    for (const account of activeAccounts) {
      await step.run(`sync-insights-${account.metaAccountId}`, async () => {
        const insights = await fetchCampaignInsights(account.metaAccountId)

        for (const insight of insights) {
          // Verificar se ja existe registro com mesmo (adAccountId, date, campaignId)
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
            await db
              .update(campaignInsights)
              .set(data)
              .where(eq(campaignInsights.id, existing.id))
          } else {
            await db.insert(campaignInsights).values({
              adAccountId: account.id,
              campaignId: insight.campaign_id,
              date: insight.date_start,
              ...data,
            })
          }
        }

        return insights.length
      })

      // Step: sincronizar ad_insights (nível anúncio/criativo)
      await step.run(`sync-ad-insights-${account.metaAccountId}`, async () => {
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

        return ads.length
      })

      // Step: atualizar saldo da conta
      await step.run(`sync-balance-${account.metaAccountId}`, async () => {
        const saldo = await fetchAccountBalance(account.metaAccountId)
        if (saldo !== null) {
          await db
            .update(adAccounts)
            .set({ saldo: saldo.toFixed(2), updatedAt: new Date() })
            .where(eq(adAccounts.id, account.id))
        }
        return saldo
      })

      // Pausa de 2s entre contas para respeitar rate limits da Meta
      await step.sleep(`pause-${account.metaAccountId}`, '2s')
      synced++
    }

    return { synced, accountsTotal: accounts }
  },
)
