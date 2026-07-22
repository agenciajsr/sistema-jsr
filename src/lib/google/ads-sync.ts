import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights } from '@/lib/db/schema'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'
import { adsSearch, listarContasDaMcc } from './ads-client'

// Sync do GOOGLE ADS — espelha o do Meta (lib/meta/sync.ts), gravando nas MESMAS
// tabelas (ad_accounts / campaign_insights) com plataforma='google'. Queries
// SEQUENCIAIS (pool max=5). Só LEMOS via GAQL — nunca alteramos campanhas.
//
// MAPEAMENTO DE RESULTADOS (documentado): o app extrai leads/vendas/conversas de
// um campo `actions` no formato da Meta ([{action_type, value}]). O Google devolve
// `metrics.conversions` como UM número (sem tipo). Como o uso de Google da agência
// é geração de LEADS (formulário/landing), sintetizamos actions=[{action_type:'lead',
// value: conversions}] — assim a métrica-herói "Leads" funciona de graça. A receita
// (conversions_value) vira actionValues=[{action_type:'purchase', value}] para ROAS
// quando houver valor de conversão (e-commerce). Revisitar se um cliente Google usar
// objetivo de vendas puro.

/** micros (int64 string) → valor decimal em string com 2 casas. */
function microsParaValor(micros: unknown): string {
  return (Number(micros ?? 0) / 1_000_000).toFixed(2)
}

/**
 * Descobre/atualiza as contas de ANÚNCIO do Google sob a MCC (gerenciadora=false)
 * em ad_accounts (plataforma='google'). Não vincula a cliente — isso é feito na UI
 * de vínculo, igual ao Meta. Espelha atualizarListaContasMeta.
 */
export async function atualizarListaContasGoogle(): Promise<number> {
  const contas = (await listarContasDaMcc()).filter((c) => !c.gerenciadora)

  for (const c of contas) {
    const [existing] = await db
      .select({ id: adAccounts.id })
      .from(adAccounts)
      .where(eq(adAccounts.metaAccountId, c.id))
      .limit(1)

    if (existing) {
      await db
        .update(adAccounts)
        .set({ nome: c.nome || c.id, currency: c.moeda ?? 'BRL', updatedAt: new Date() })
        .where(eq(adAccounts.id, existing.id))
    } else {
      await db.insert(adAccounts).values({
        plataforma: 'google',
        metaAccountId: c.id, // reusa a coluna: aqui guarda o customer id do Google
        nome: c.nome || c.id,
        currency: c.moeda ?? 'BRL',
        // accountStatus/fundingSource/saldo ficam null: são conceitos do Meta.
      })
    }
  }

  return contas.length
}

type LinhaCampanha = {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string }
  segments?: { date?: string }
  metrics?: {
    costMicros?: unknown
    impressions?: unknown
    clicks?: unknown
    averageCpc?: unknown
    averageCpm?: unknown
    ctr?: unknown
    conversions?: unknown
    conversionsValue?: unknown
  }
}

/**
 * Sincroniza os insights DIÁRIOS por campanha de UMA conta Google (últimos 30 dias
 * até hoje-BR), gravando/atualizando campaign_insights. Espelha syncSingleAccount.
 * `account.metaAccountId` = customer id do Google.
 */
export async function syncSingleAccountGoogle(account: { id: string; metaAccountId: string }): Promise<number> {
  const until = hojeBrasilia()
  const since = dataMenosDias(30, until)

  const query =
    'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ' +
    'segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, ' +
    'metrics.average_cpc, metrics.average_cpm, metrics.ctr, metrics.conversions, metrics.conversions_value ' +
    `FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`

  const rows = (await adsSearch(account.metaAccountId, query)) as LinhaCampanha[]

  let count = 0
  for (const row of rows) {
    const campaignId = row.campaign?.id
    const date = row.segments?.date
    if (!campaignId || !date) continue
    const m = row.metrics ?? {}

    const conversions = Number(m.conversions ?? 0)
    const conversionsValue = Number(m.conversionsValue ?? 0)
    // Sintetiza o formato da Meta para a máquina de resultados (ver cabeçalho).
    const actions = conversions > 0 ? [{ action_type: 'lead', value: String(conversions) }] : null
    const actionValues =
      conversionsValue > 0 ? [{ action_type: 'purchase', value: String(conversionsValue) }] : null

    const data = {
      campaignName: row.campaign?.name ?? campaignId,
      spend: microsParaValor(m.costMicros),
      impressions: Number(m.impressions ?? 0),
      clicks: Number(m.clicks ?? 0),
      reach: 0, // Google não expõe "reach" a nível de campanha como a Meta.
      cpc: microsParaValor(m.averageCpc),
      cpm: microsParaValor(m.averageCpm),
      // Google devolve ctr como FRAÇÃO (0.0234); a Meta grava percentual (2.34).
      ctr: (Number(m.ctr ?? 0) * 100).toFixed(4),
      actions,
      actionValues,
      objective: row.campaign?.advertisingChannelType ?? null,
      effectiveStatus: row.campaign?.status ?? null,
      syncedAt: new Date(),
    }

    const [existing] = await db
      .select({ id: campaignInsights.id })
      .from(campaignInsights)
      .where(
        and(
          eq(campaignInsights.adAccountId, account.id),
          eq(campaignInsights.date, date),
          eq(campaignInsights.campaignId, campaignId),
        ),
      )
      .limit(1)

    if (existing) {
      await db.update(campaignInsights).set(data).where(eq(campaignInsights.id, existing.id))
    } else {
      await db.insert(campaignInsights).values({ adAccountId: account.id, campaignId, date, ...data })
    }
    count++
  }

  return count
}

/**
 * Orquestrador do sync Google: atualiza a lista de contas, depois sincroniza os
 * insights de cada conta google ATIVA. Degradação graciosa por conta (uma falha
 * não derruba as outras). Espelha sincronizarTudoMeta. Usado de carona no cron.
 */
export async function sincronizarTudoGoogle(): Promise<{ contas: number; insights: number }> {
  const contas = await atualizarListaContasGoogle()

  const linhas = await db
    .select({ id: adAccounts.id, metaAccountId: adAccounts.metaAccountId })
    .from(adAccounts)
    .where(and(eq(adAccounts.plataforma, 'google'), eq(adAccounts.ativo, true)))

  let insights = 0
  for (const conta of linhas) {
    try {
      insights += await syncSingleAccountGoogle(conta)
    } catch (e) {
      console.error(`[sync-google] conta ${conta.metaAccountId} falhou:`, e)
    }
  }

  return { contas, insights }
}
