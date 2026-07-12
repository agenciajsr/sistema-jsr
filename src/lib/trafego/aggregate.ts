import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { format, subDays } from 'date-fns'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'

export type Nicho = 'ecommerce' | 'negocio_local' | 'infoproduto'

export type ResultadoActions = {
  leads: number
  vendas: number
  conversas: number
  linkClicks: number
}

// Mapeamento dos action_types da Meta por metrica de negocio.
// A ORDEM de cada lista e a PRIORIDADE de dedup: usamos o valor do PRIMEIRO
// action_type presente na linha, nunca somando grupos diferentes de compra/conversa
// na mesma linha (evita dupla contagem — a Meta emite variantes redundantes do
// mesmo evento, ex.: purchase + omni_purchase + offsite_conversion.fb_pixel_purchase).
const LEADS_TYPES = [
  'lead',
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
]
const VENDAS_TYPES = [
  'omni_purchase', // prioridade: consolida on/offsite
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_conversion.purchase',
]
const CONVERSAS_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d', // prioridade
  'onsite_conversion.total_messaging_connection',
]
const LINK_CLICK_TYPES = ['link_click']

type ActionItem = { action_type: string; value: string }

function isActionItem(x: unknown): x is ActionItem {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { action_type?: unknown }).action_type === 'string' &&
    typeof (x as { value?: unknown }).value === 'string'
  )
}

/**
 * Soma (com dedup por prioridade) os valores dos action_types de um grupo.
 * Percorre `types` na ordem de prioridade e retorna o total do PRIMEIRO
 * action_type presente na linha — evita dupla contagem entre variantes do
 * mesmo evento. Se houver o mesmo action_type repetido, soma essas ocorrencias.
 */
function somarGrupo(items: ActionItem[], types: string[]): number {
  for (const t of types) {
    const matches = items.filter((a) => a.action_type === t)
    if (matches.length > 0) {
      return matches.reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
    }
  }
  return 0
}

/**
 * Extrai leads/vendas/conversas/linkClicks do campo `actions` (jsonb) da Meta.
 * Type-narrowing seguro: qualquer valor null/undefined/nao-array -> tudo 0 (nunca lanca).
 */
export function parseActions(actions: unknown): ResultadoActions {
  if (!Array.isArray(actions)) {
    return { leads: 0, vendas: 0, conversas: 0, linkClicks: 0 }
  }
  const items = actions.filter(isActionItem)
  return {
    leads: somarGrupo(items, LEADS_TYPES),
    vendas: somarGrupo(items, VENDAS_TYPES),
    conversas: somarGrupo(items, CONVERSAS_TYPES),
    linkClicks: somarGrupo(items, LINK_CLICK_TYPES),
  }
}

/**
 * Extrai a RECEITA total (valor monetário de compras) do campo `action_values` (jsonb) da Meta.
 * Usa a mesma lógica de dedup/prioridade de VENDAS_TYPES.
 * Retorna 0 quando não há dados válidos (nunca lança).
 */
export function parseActionValues(actionValues: unknown): number {
  if (!Array.isArray(actionValues)) return 0
  const items = actionValues.filter(isActionItem)
  return somarGrupo(items, VENDAS_TYPES)
}

export type ChaveHeroi = 'vendas' | 'conversas' | 'leads'
export type Heroi = { chave: ChaveHeroi; label: string }

/**
 * Metrica-heroi destacada por nicho:
 * ecommerce -> Vendas, negocio_local -> Conversas (fallback conceitual leads),
 * infoproduto -> Leads.
 */
export function metricaHeroi(nicho: Nicho): Heroi {
  switch (nicho) {
    case 'ecommerce':
      return { chave: 'vendas', label: 'Vendas' }
    case 'negocio_local':
      return { chave: 'conversas', label: 'Conversas' }
    case 'infoproduto':
    default:
      return { chave: 'leads', label: 'Leads' }
  }
}

export type ClienteComContas = { id: string; nome: string; nicho: Nicho }

/**
 * Lista clientes (id, nome, nicho) que possuem ao menos uma conta Meta ativa vinculada.
 * Distinct por cliente, ordenado por nome.
 */
export async function listarClientesComContas(): Promise<ClienteComContas[]> {
  const rows = await db
    .selectDistinct({ id: clientes.id, nome: clientes.nome, nicho: clientes.nicho })
    .from(clientes)
    .innerJoin(adAccounts, eq(adAccounts.clienteId, clientes.id))
    .where(and(eq(adAccounts.plataforma, 'meta'), eq(adAccounts.ativo, true)))
    .orderBy(clientes.nome)

  return rows
}

export type CampanhaRanking = {
  campaignId: string
  campaignName: string
  spend: number
  resultadoPrimario: number
  cpaOuCpl: number | null
}

export type CriativoRanking = {
  adId: string
  adName: string
  adsetName: string
  thumbUrl: string | null
  spend: number
  resultadoPrimario: number
  cpaOuCpl: number | null
}

export type ConjuntoRanking = {
  adsetId: string
  adsetName: string
  spend: number
  resultadoPrimario: number
  cpaOuCpl: number | null
}

export type ResumoCliente = {
  clienteId: string
  contasUnificadas: number
  heroi: Heroi
  totais: {
    spend: number
    impressions: number
    clicks: number
    reach: number
    leads: number
    vendas: number
    conversas: number
    linkClicks: number
  }
  derivadas: {
    cpm: number | null
    ctr: number | null
    cpl: number | null
    cpa: number | null
    custoPorResultadoHeroi: number | null
  }
  serieSpendPorDia: { date: string; spend: number }[]
  ranking: CampanhaRanking[]
  receita: number
  roas: number | null
  topCriativos: CriativoRanking[]
  topConjuntos: ConjuntoRanking[]
  temDados: boolean
}

function resultadoDaChave(r: ResultadoActions, chave: ChaveHeroi): number {
  if (chave === 'vendas') return r.vendas
  if (chave === 'conversas') return r.conversas
  return r.leads
}

function resumoVazio(clienteId: string, heroi: Heroi, contas: number): ResumoCliente {
  return {
    clienteId,
    contasUnificadas: contas,
    heroi,
    totais: { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, vendas: 0, conversas: 0, linkClicks: 0 },
    derivadas: { cpm: null, ctr: null, cpl: null, cpa: null, custoPorResultadoHeroi: null },
    serieSpendPorDia: [],
    ranking: [],
    receita: 0,
    roas: null,
    topCriativos: [],
    topConjuntos: [],
    temDados: false,
  }
}

export type Periodo = 'hoje' | 'ontem' | '7d' | '30d'

/**
 * Agrega TODAS as contas Meta de um cliente num resumo unificado para o
 * período solicitado. Parseia `actions` de cada linha diaria para
 * derivar leads/vendas/conversas. Nunca lanca: retorna resumo zerado
 * (temDados=false) quando nao ha contas, dados ou sessao.
 */
export async function getResumoCliente(
  clienteId: string,
  periodo: Periodo = '30d',
): Promise<ResumoCliente | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // Nicho do cliente -> metrica-heroi
  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, clienteId),
    columns: { id: true, nicho: true },
  })
  const heroi = metricaHeroi((cliente?.nicho ?? 'infoproduto') as Nicho)

  if (!cliente) return resumoVazio(clienteId, heroi, 0)

  const contas = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
        eq(adAccounts.plataforma, 'meta'),
        eq(adAccounts.ativo, true),
      ),
    )

  if (contas.length === 0) return resumoVazio(clienteId, heroi, 0)

  const hoje = new Date()
  const hojeStr = format(hoje, 'yyyy-MM-dd')
  let dataMinima: string
  let dataMaxima: string | null = null // null = sem limite superior (ate hoje)
  switch (periodo) {
    case 'hoje':
      dataMinima = hojeStr
      break
    case 'ontem': {
      const ontemStr = format(subDays(hoje, 1), 'yyyy-MM-dd')
      dataMinima = ontemStr
      dataMaxima = ontemStr
      break
    }
    case '7d':
      dataMinima = format(subDays(hoje, 7), 'yyyy-MM-dd')
      break
    case '30d':
    default:
      dataMinima = format(subDays(hoje, 30), 'yyyy-MM-dd')
      break
  }

  const insightsConditions = [
    inArray(campaignInsights.adAccountId, contas.map((c) => c.id)),
    gte(campaignInsights.date, dataMinima),
    ...(dataMaxima ? [lte(campaignInsights.date, dataMaxima)] : []),
  ]

  const insights = await db
    .select({
      campaignId: campaignInsights.campaignId,
      campaignName: campaignInsights.campaignName,
      date: campaignInsights.date,
      spend: campaignInsights.spend,
      impressions: campaignInsights.impressions,
      clicks: campaignInsights.clicks,
      reach: campaignInsights.reach,
      actions: campaignInsights.actions,
      actionValues: campaignInsights.actionValues,
    })
    .from(campaignInsights)
    .where(and(...insightsConditions))

  if (insights.length === 0) return resumoVazio(clienteId, heroi, contas.length)

  const totais = { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, vendas: 0, conversas: 0, linkClicks: 0 }
  let receita = 0
  const spendPorDia = new Map<string, number>()
  const porCampanha = new Map<string, { campaignName: string; spend: number; resultadoPrimario: number }>()

  for (const i of insights) {
    const spend = Number(i.spend) || 0
    const r = parseActions(i.actions)

    totais.spend += spend
    totais.impressions += i.impressions ?? 0
    totais.clicks += i.clicks ?? 0
    totais.reach += i.reach ?? 0
    totais.leads += r.leads
    totais.vendas += r.vendas
    totais.conversas += r.conversas
    totais.linkClicks += r.linkClicks
    receita += parseActionValues(i.actionValues)

    spendPorDia.set(i.date, (spendPorDia.get(i.date) ?? 0) + spend)

    const resultado = resultadoDaChave(r, heroi.chave)
    const existing = porCampanha.get(i.campaignId)
    if (existing) {
      existing.spend += spend
      existing.resultadoPrimario += resultado
    } else {
      porCampanha.set(i.campaignId, { campaignName: i.campaignName, spend, resultadoPrimario: resultado })
    }
  }

  const serieSpendPorDia = Array.from(spendPorDia.entries())
    .map(([date, spend]) => ({ date, spend }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const ranking: CampanhaRanking[] = Array.from(porCampanha.entries())
    .map(([campaignId, v]) => ({
      campaignId,
      campaignName: v.campaignName,
      spend: v.spend,
      resultadoPrimario: v.resultadoPrimario,
      cpaOuCpl: v.resultadoPrimario > 0 ? v.spend / v.resultadoPrimario : null,
    }))
    .sort((a, b) => b.resultadoPrimario - a.resultadoPrimario || b.spend - a.spend)
    .slice(0, 10)

  const resultadoHeroiTotal = resultadoDaChave(
    { leads: totais.leads, vendas: totais.vendas, conversas: totais.conversas, linkClicks: totais.linkClicks },
    heroi.chave,
  )

  const derivadas = {
    cpm: totais.impressions > 0 ? (totais.spend / totais.impressions) * 1000 : null,
    ctr: totais.impressions > 0 ? (totais.clicks / totais.impressions) * 100 : null,
    cpl: totais.leads > 0 ? totais.spend / totais.leads : null,
    cpa: totais.vendas > 0 ? totais.spend / totais.vendas : null,
    custoPorResultadoHeroi: resultadoHeroiTotal > 0 ? totais.spend / resultadoHeroiTotal : null,
  }

  const roas = receita > 0 && totais.spend > 0 ? receita / totais.spend : null

  // --- Top Criativos e Conjuntos (a partir de ad_insights) ---
  let adRows: { adId: string; adName: string; adsetId: string | null; adsetName: string | null; thumbnailUrl: string | null; spend: string; actions: unknown }[] = []
  try {
    adRows = await db
      .select({
        adId: adInsights.adId,
        adName: adInsights.adName,
        adsetId: adInsights.adsetId,
        adsetName: adInsights.adsetName,
        thumbnailUrl: adInsights.thumbnailUrl,
        spend: adInsights.spend,
        actions: adInsights.actions,
      })
      .from(adInsights)
      .where(
        and(
          inArray(adInsights.adAccountId, contas.map((c) => c.id)),
          gte(adInsights.dateStart, dataMinima),
          ...(dataMaxima ? [lte(adInsights.dateStart, dataMaxima)] : []),
        ),
      )
  } catch {
    // ad_insights pode não existir ainda — continuar sem criativos/conjuntos
  }

  // Agrupar por adId (criativos)
  const porCriativo = new Map<string, { adName: string; adsetName: string; thumbUrl: string | null; spend: number; resultadoPrimario: number }>()
  // Agrupar por adsetId (conjuntos)
  const porConjunto = new Map<string, { adsetName: string; spend: number; resultadoPrimario: number }>()

  for (const row of adRows) {
    const spend = Number(row.spend) || 0
    const r = parseActions(row.actions)
    const resultado = resultadoDaChave(r, heroi.chave)

    // Criativos
    const existC = porCriativo.get(row.adId)
    if (existC) {
      existC.spend += spend
      existC.resultadoPrimario += resultado
      if (!existC.thumbUrl && row.thumbnailUrl) existC.thumbUrl = row.thumbnailUrl
    } else {
      porCriativo.set(row.adId, {
        adName: row.adName,
        adsetName: row.adsetName ?? '',
        thumbUrl: row.thumbnailUrl ?? null,
        spend,
        resultadoPrimario: resultado,
      })
    }

    // Conjuntos
    const adsetKey = row.adsetId ?? '_sem_conjunto'
    const existJ = porConjunto.get(adsetKey)
    if (existJ) {
      existJ.spend += spend
      existJ.resultadoPrimario += resultado
    } else {
      porConjunto.set(adsetKey, {
        adsetName: row.adsetName ?? 'Sem conjunto',
        spend,
        resultadoPrimario: resultado,
      })
    }
  }

  const topCriativos: CriativoRanking[] = Array.from(porCriativo.entries())
    .map(([adId, v]) => ({
      adId,
      adName: v.adName,
      adsetName: v.adsetName,
      thumbUrl: v.thumbUrl,
      spend: v.spend,
      resultadoPrimario: v.resultadoPrimario,
      cpaOuCpl: v.resultadoPrimario > 0 ? v.spend / v.resultadoPrimario : null,
    }))
    .sort((a, b) => b.resultadoPrimario - a.resultadoPrimario || b.spend - a.spend)
    .slice(0, 8)

  const topConjuntos: ConjuntoRanking[] = Array.from(porConjunto.entries())
    .map(([adsetId, v]) => ({
      adsetId,
      adsetName: v.adsetName,
      spend: v.spend,
      resultadoPrimario: v.resultadoPrimario,
      cpaOuCpl: v.resultadoPrimario > 0 ? v.spend / v.resultadoPrimario : null,
    }))
    .sort((a, b) => b.resultadoPrimario - a.resultadoPrimario || b.spend - a.spend)
    .slice(0, 6)

  return {
    clienteId,
    contasUnificadas: contas.length,
    heroi,
    totais,
    derivadas,
    serieSpendPorDia,
    ranking,
    receita,
    roas,
    topCriativos,
    topConjuntos,
    temDados: true,
  }
}

// --- Comparação de período (para avaliação de saúde de campanhas) ---

export type MetricasIntervalo = {
  spend: number
  impressions: number
  clicks: number
  ctr: number | null // (clicks/impressions)*100
  leads: number
  vendas: number
  conversas: number
  resultadoHeroi: number // resultado da chave-herói do nicho
  cpa: number | null // spend/vendas
  cpl: number | null // spend/leads
  custoPorResultadoHeroi: number | null // spend/resultadoHeroi
  heroi: Heroi
}

function metricasVazias(heroi: Heroi): MetricasIntervalo {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: null,
    leads: 0,
    vendas: 0,
    conversas: 0,
    resultadoHeroi: 0,
    cpa: null,
    cpl: null,
    custoPorResultadoHeroi: null,
    heroi,
  }
}

/**
 * Totais e derivadas de um cliente para um INTERVALO explícito e FECHADO
 * (dataMinima <= date <= dataMaxima, ambas 'yyyy-MM-dd'). Usado para comparar
 * "atual (7d)" vs "anterior (7d)" na avaliação de saúde.
 * Mesma semântica de derivadas de getResumoCliente (null quando denominador 0).
 * NUNCA lança: sem contas / sem linhas → MetricasIntervalo zerado com heroi correto.
 * Não exige sessão (é chamada por orquestradores server-side já autenticados).
 */
export async function getMetricasIntervalo(
  clienteId: string,
  dataMinima: string,
  dataMaxima: string,
): Promise<MetricasIntervalo> {
  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, clienteId),
    columns: { id: true, nicho: true },
  })
  const heroi = metricaHeroi((cliente?.nicho ?? 'infoproduto') as Nicho)

  if (!cliente) return metricasVazias(heroi)

  const contas = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
        eq(adAccounts.plataforma, 'meta'),
        eq(adAccounts.ativo, true),
      ),
    )

  if (contas.length === 0) return metricasVazias(heroi)

  const insights = await db
    .select({
      spend: campaignInsights.spend,
      impressions: campaignInsights.impressions,
      clicks: campaignInsights.clicks,
      actions: campaignInsights.actions,
    })
    .from(campaignInsights)
    .where(
      and(
        inArray(
          campaignInsights.adAccountId,
          contas.map((c) => c.id),
        ),
        gte(campaignInsights.date, dataMinima),
        lte(campaignInsights.date, dataMaxima),
      ),
    )

  if (insights.length === 0) return metricasVazias(heroi)

  let spend = 0
  let impressions = 0
  let clicks = 0
  let leads = 0
  let vendas = 0
  let conversas = 0

  for (const i of insights) {
    spend += Number(i.spend) || 0
    impressions += i.impressions ?? 0
    clicks += i.clicks ?? 0
    const r = parseActions(i.actions)
    leads += r.leads
    vendas += r.vendas
    conversas += r.conversas
  }

  const resultadoHeroi = resultadoDaChave(
    { leads, vendas, conversas, linkClicks: 0 },
    heroi.chave,
  )

  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    leads,
    vendas,
    conversas,
    resultadoHeroi,
    cpa: vendas > 0 ? spend / vendas : null,
    cpl: leads > 0 ? spend / leads : null,
    custoPorResultadoHeroi: resultadoHeroi > 0 ? spend / resultadoHeroi : null,
    heroi,
  }
}
