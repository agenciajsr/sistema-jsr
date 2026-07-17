import { eq, and } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights, demografiaInsights, regiaoInsights } from '@/lib/db/schema'
import {
  fetchMetaAdAccounts,
  fetchCampaignInsights,
  fetchCampaignStatuses,
  fetchAdInsights,
  fetchAdMeta,
  fetchAccountBalance,
  fetchDemografiaInsights,
  fetchRegiaoInsights,
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
      objective: insight.objective ?? null,
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

  // effective_status por campanha (fix 17/jul/2026): um UPDATE por campanha
  // cobre todas as linhas históricas — a UI usa o status mais recente.
  try {
    const statuses = await fetchCampaignStatuses(account.metaAccountId)
    for (const [campaignId, status] of statuses) {
      await db
        .update(campaignInsights)
        .set({ effectiveStatus: status })
        .where(
          and(
            eq(campaignInsights.adAccountId, account.id),
            eq(campaignInsights.campaignId, campaignId),
          ),
        )
    }
  } catch (err) {
    console.warn(`[sync-meta] Erro status de campanhas ${account.metaAccountId}:`, err)
  }

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

  // Demografia (idade × gênero) e Regiões — janela agregada ~30d, como ad_insights:
  // 1 janela nova por dia de sync. Chamadas SEQUENCIAIS (rate limit da Meta) e
  // bloco em try/catch próprio: nunca derruba o sync da conta.
  try {
    const demoRows = await fetchDemografiaInsights(account.metaAccountId)
    for (const row of demoRows) {
      const [existing] = await db
        .select({ id: demografiaInsights.id })
        .from(demografiaInsights)
        .where(
          and(
            eq(demografiaInsights.adAccountId, account.id),
            eq(demografiaInsights.campaignId, row.campaign_id),
            eq(demografiaInsights.age, row.age),
            eq(demografiaInsights.gender, row.gender),
            eq(demografiaInsights.dateStart, row.date_start),
          ),
        )
        .limit(1)

      const data = {
        campaignName: row.campaign_name,
        spend: row.spend,
        impressions: parseInt(row.impressions, 10),
        clicks: parseInt(row.clicks, 10),
        actions: row.actions.length > 0 ? row.actions : null,
        actionValues: row.action_values.length > 0 ? row.action_values : null,
        dateStop: row.date_stop,
        syncedAt: new Date(),
      }

      if (existing) {
        await db.update(demografiaInsights).set(data).where(eq(demografiaInsights.id, existing.id))
      } else {
        await db.insert(demografiaInsights).values({
          adAccountId: account.id,
          campaignId: row.campaign_id,
          age: row.age,
          gender: row.gender,
          dateStart: row.date_start,
          ...data,
        })
      }
    }

    const regiaoRows = await fetchRegiaoInsights(account.metaAccountId)
    for (const row of regiaoRows) {
      const [existing] = await db
        .select({ id: regiaoInsights.id })
        .from(regiaoInsights)
        .where(
          and(
            eq(regiaoInsights.adAccountId, account.id),
            eq(regiaoInsights.campaignId, row.campaign_id),
            eq(regiaoInsights.region, row.region),
            eq(regiaoInsights.dateStart, row.date_start),
          ),
        )
        .limit(1)

      const data = {
        campaignName: row.campaign_name,
        spend: row.spend,
        impressions: parseInt(row.impressions, 10),
        clicks: parseInt(row.clicks, 10),
        actions: row.actions.length > 0 ? row.actions : null,
        actionValues: row.action_values.length > 0 ? row.action_values : null,
        dateStop: row.date_stop,
        syncedAt: new Date(),
      }

      if (existing) {
        await db.update(regiaoInsights).set(data).where(eq(regiaoInsights.id, existing.id))
      } else {
        await db.insert(regiaoInsights).values({
          adAccountId: account.id,
          campaignId: row.campaign_id,
          region: row.region,
          dateStart: row.date_start,
          ...data,
        })
      }
    }
  } catch (err) {
    console.warn(`[sync-meta] Erro demografia/regioes ${account.metaAccountId}:`, err)
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

/**
 * Descobre/atualiza a lista de contas de anúncio da Meta (owned + client) e faz o
 * upsert em `adAccounts`. Espelha o passo 'sync-ad-accounts' da função Inngest.
 * Pode lançar se a API da Meta falhar inteira — quem chama trata (a rota de cron
 * envolve em try/catch). Retorna a quantidade de contas retornadas pela Meta.
 */
export async function atualizarListaContasMeta(): Promise<number> {
  const metaAccounts = await fetchMetaAdAccounts()

  for (const acc of metaAccounts) {
    // Remover prefixo "act_" do id
    const numericId = acc.id.replace(/^act_/, '')

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
          fundingSource: acc.funding_source ?? null,
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
        fundingSource: acc.funding_source ?? null,
      })
    }
  }

  return metaAccounts.length
}

/**
 * Orquestrador completo do sync Meta: descobre/atualiza as contas ANTES de
 * sincronizar insights + saldo de todas as contas ativas. Usado pela rota de cron
 * (/api/cron/sync-meta). Reaproveita `sincronizarContasMeta` — não duplica a lógica
 * de insights.
 */
export async function sincronizarTudoMeta(): Promise<{ contas: number; insights: number }> {
  await atualizarListaContasMeta()
  return sincronizarContasMeta(null)
}

/**
 * Sync LEVE para a página de Verbas: atualiza a lista de contas (status/nome/funding)
 * e o SALDO de cada conta ativa — SEM o sync pesado de insights de campanha/criativo
 * (que leva ~3 min e não completa de forma confiável numa requisição do navegador).
 * Rápido (~10s) e confiável para o botão "Sincronizar contas" da Verba.
 * `updatedAt` é sempre atualizado (reflete a "Última Sync"); `saldo` só quando não-nulo.
 */
export async function sincronizarVerbas(): Promise<{ contas: number }> {
  // 1. Atualiza lista/status/funding (e descobre contas novas). Não pode derrubar o resto.
  try {
    await atualizarListaContasMeta()
  } catch (err) {
    console.warn('[sync-verbas] Falha ao atualizar lista de contas:', err)
  }

  // 2. Atualiza o saldo de cada conta ativa (fetchAccountBalance é rápido).
  const accounts = await db
    .select({ id: adAccounts.id, metaAccountId: adAccounts.metaAccountId })
    .from(adAccounts)
    .where(and(eq(adAccounts.ativo, true), eq(adAccounts.plataforma, 'meta')))

  for (const account of accounts) {
    try {
      const saldo = await fetchAccountBalance(account.metaAccountId)
      await db
        .update(adAccounts)
        .set({
          ...(saldo !== null ? { saldo: saldo.toFixed(2) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(adAccounts.id, account.id))
    } catch (err) {
      console.warn(`[sync-verbas] Erro no saldo da conta ${account.metaAccountId}:`, err)
    }
  }

  return { contas: accounts.length }
}
