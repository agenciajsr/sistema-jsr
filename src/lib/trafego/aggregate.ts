import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'

// A mecânica de parsing de actions/action_values agora mora em ./metricas
// (módulo PURO, testável sem banco). Este arquivo reexporta para manter a
// fonte única e a compatibilidade dos imports existentes.
import { parseActions, parseActionValues } from './metricas'

export {
  parseActions,
  parseActionsExtendido,
  parseActionValues,
  somarGrupo,
  isActionItem,
  type ActionItem,
  type ResultadoActions,
  type ResultadoActionsExtendido,
} from './metricas'

import type { ResultadoActions } from './metricas'

export type Nicho = 'ecommerce' | 'negocio_local' | 'infoproduto'

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

export type ClasseObjetivo = 'vendas' | 'leads' | 'conversas' | 'engajamento' | 'trafego'

/**
 * Classifica o OBJETIVO PRINCIPAL do cliente (texto livre digitado no cadastro)
 * na métrica de negócio correspondente. Fonte única de verdade usada por Painel,
 * Campanhas, avaliação de saúde e relatório — para todos concordarem.
 *
 * Prioridade proposital: mensageria (WhatsApp) primeiro, porque o MEIO define a
 * métrica real na Meta mesmo quando o texto diz "leads" (ex.: "leads iniciando no
 * WhatsApp" = conversas iniciadas, não action 'lead'). Retorna null se nada casar.
 */
export function classificarObjetivo(objetivoPrincipal: string | null): ClasseObjetivo | null {
  const obj = (objetivoPrincipal ?? '').toLowerCase()
  if (!obj.trim()) return null
  if (/whats|conversa|mensag|direct|clique para|click to message/.test(obj)) return 'conversas'
  if (/venda|vender|compra|comprar|card[aá]pio|checkout|\bcota|e-?commerce|\bloja|faturar/.test(obj)) return 'vendas'
  if (/lead|formul|cadastr|agendam|or[çc]ament|inscri/.test(obj)) return 'leads'
  if (/engajamento|seguidor|perfil|reconhecim/.test(obj)) return 'engajamento'
  if (/tr[aá]fego|visita|acesso ao site/.test(obj)) return 'trafego'
  return null
}

const LABEL_HEROI: Record<ChaveHeroi, string> = {
  vendas: 'Vendas',
  conversas: 'Conversas',
  leads: 'Leads',
}

/**
 * Métrica-herói do cliente derivada do OBJETIVO cadastrado (com fallback pelo
 * nicho quando o texto não classifica). Substitui metricaHeroi(nicho) puro.
 */
export function heroiDoObjetivo(objetivoPrincipal: string | null, nicho: Nicho): Heroi {
  const classe = classificarObjetivo(objetivoPrincipal)
  if (classe === 'vendas' || classe === 'conversas' || classe === 'leads') {
    return { chave: classe, label: LABEL_HEROI[classe] }
  }
  // engajamento/trafego/null não são chaves-herói de conversão → usa o nicho.
  return metricaHeroi(nicho)
}

/**
 * Investimento (spend) dos últimos 30 dias por cliente, em UMA query agregada
 * (join adAccounts + campaignInsights, GROUP BY cliente). Leve de propósito: a
 * tela inicial de /campanhas mostra cards de todos os clientes e NÃO pode rodar
 * getResumoCliente/getSaudeDoCliente por cliente (pesadas, pool max=5). Retorna um
 * mapa clienteId -> investido30d; ausência de linha = sem gasto no período.
 */
export async function getInvestido30dPorCliente(): Promise<Map<string, number>> {
  const user = await getCurrentUser()
  if (!user) return new Map()

  const dataMinima = dataMenosDias(30, hojeBrasilia())
  const rows = await db
    .select({
      clienteId: adAccounts.clienteId,
      investido: sql<string>`coalesce(sum(${campaignInsights.spend}), 0)`,
    })
    .from(campaignInsights)
    .innerJoin(adAccounts, eq(campaignInsights.adAccountId, adAccounts.id))
    .where(
      and(
        eq(adAccounts.ativo, true),
        gte(campaignInsights.date, dataMinima),
      ),
    )
    .groupBy(adAccounts.clienteId)

  const mapa = new Map<string, number>()
  for (const r of rows) {
    if (r.clienteId) mapa.set(r.clienteId, Number(r.investido) || 0)
  }
  return mapa
}

export type ClienteComContas = { id: string; nome: string; nicho: Nicho; objetivoPrincipal: string | null; metaCpa: string | null; metaRoas: string | null; interno: boolean }

/**
 * Lista clientes (id, nome, nicho, objetivo, metas) que possuem ao menos uma conta
 * ativa (Meta ou Google) vinculada. Distinct por cliente, ordenado por nome.
 */
export async function listarClientesComContas(): Promise<ClienteComContas[]> {
  const rows = await db
    .selectDistinct({ id: clientes.id, nome: clientes.nome, nicho: clientes.nicho, objetivoPrincipal: clientes.objetivoPrincipal, metaCpa: clientes.metaCpa, metaRoas: clientes.metaRoas, interno: clientes.interno })
    .from(clientes)
    .innerJoin(adAccounts, eq(adAccounts.clienteId, clientes.id))
    .where(eq(adAccounts.ativo, true))
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
    columns: { id: true, nicho: true, objetivoPrincipal: true },
  })
  const heroi = heroiDoObjetivo(cliente?.objetivoPrincipal ?? null, (cliente?.nicho ?? 'infoproduto') as Nicho)

  if (!cliente) return resumoVazio(clienteId, heroi, 0)

  const contas = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
        eq(adAccounts.ativo, true),
      ),
    )

  if (contas.length === 0) return resumoVazio(clienteId, heroi, 0)

  // Base "hoje" no fuso de Brasília (fuso da conta = data gravada em campaign_insights.date),
  // não no fuso do servidor (UTC na Vercel), para os filtros Hoje/Ontem baterem com o dado.
  const hojeStr = hojeBrasilia()
  let dataMinima: string
  let dataMaxima: string | null = null // null = sem limite superior (ate hoje)
  switch (periodo) {
    case 'hoje':
      dataMinima = hojeStr
      break
    case 'ontem': {
      const ontemStr = dataMenosDias(1, hojeStr)
      dataMinima = ontemStr
      dataMaxima = ontemStr
      break
    }
    case '7d':
      dataMinima = dataMenosDias(7, hojeStr)
      break
    case '30d':
    default:
      dataMinima = dataMenosDias(30, hojeStr)
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
    columns: { id: true, nicho: true, objetivoPrincipal: true },
  })
  const heroi = heroiDoObjetivo(cliente?.objetivoPrincipal ?? null, (cliente?.nicho ?? 'infoproduto') as Nicho)

  if (!cliente) return metricasVazias(heroi)

  const contas = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
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
