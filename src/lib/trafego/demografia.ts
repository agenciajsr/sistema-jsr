// Mecânica PURA da Etapa 2 do painel /campanhas (zero import de db/auth/react):
// dedupe de janelas ~30d, agregação de demografia (idade × gênero), ranking de
// regiões e mapeamento do objective oficial da Meta para o rótulo do chip —
// com classificarObjetivo (objetivo cadastrado do cliente) como FALLBACK.
//
// ⚠️ O ranking de regiões tem MÉTRICA ADAPTATIVA (rankingDeRegioes): o Meta não
// entrega conversões de pixel (compras/leads offsite) por região — limitação de
// privacidade da plataforma. Quando a chave-herói não chega, o ranking usa
// cliques no link. A decisão é dirigida pelo dado, nunca por tipo de cliente.
//
// ⚠️ Demografia/regiões vêm do sync como JANELA AGREGADA de ~30 dias (1 janela
// nova por dia, igual ad_insights): o consumidor deve usar SEMPRE a janela mais
// recente por chave (deduplicarJanelaMaisRecente), nunca somar janelas.

import { parseActionsExtendido } from './metricas'
import { classificarObjetivo, type ChaveHeroi } from './aggregate'

/** Linha bruta de demografia_insights (como sai do banco). */
export type LinhaDemografiaBruta = {
  campaignId: string
  campaignName: string
  age: string
  gender: string
  spend: string
  impressions: number | null
  clicks: number | null
  actions: unknown
  actionValues: unknown
  dateStop: string
}

/** Linha bruta de regiao_insights (como sai do banco). */
export type LinhaRegiaoBruta = {
  campaignId: string
  campaignName: string
  region: string
  spend: string
  impressions: number | null
  clicks: number | null
  actions: unknown
  actionValues: unknown
  dateStop: string
}

/**
 * Dedupe de janelas ~30d: para cada chave, mantém SÓ a linha com maior dateStop
 * (janela mais recente). Somar janelas de dias de sync diferentes contaria o
 * mesmo período N vezes.
 */
export function deduplicarJanelaMaisRecente<T extends { dateStop: string }>(
  rows: T[],
  chave: (row: T) => string,
): T[] {
  const maisRecente = new Map<string, T>()
  for (const row of rows) {
    const k = chave(row)
    const atual = maisRecente.get(k)
    if (!atual || row.dateStop > atual.dateStop) maisRecente.set(k, row)
  }
  return Array.from(maisRecente.values())
}

/** Linha agregada de demografia — a UI filtra por campanha e escolhe a métrica client-side. */
export type LinhaDemografia = {
  campaignId: string
  campaignName: string
  age: string
  gender: string
  spend: number
  impressions: number
  clicks: number
  resultados: number // resultado da chave-herói do cliente — preenchido pelo painel (aqui nasce 0)
  compras: number
  leads: number
  conversas: number
}

/**
 * Converte linhas brutas (JÁ deduplicadas) em linhas agregadas por
 * (campanha, faixa etária, gênero), extraindo compras/leads/conversas via
 * parseActionsExtendido. `resultados` nasce 0 — o painel preenche com a
 * chave-herói do cliente (a UI escolhe a métrica exibida client-side).
 */
export function agregarDemografia(rows: LinhaDemografiaBruta[]): LinhaDemografia[] {
  const porChave = new Map<string, LinhaDemografia>()
  for (const row of rows) {
    const k = `${row.campaignId}|${row.age}|${row.gender}`
    const spend = Number(row.spend) || 0
    const r = parseActionsExtendido(row.actions)
    const exist = porChave.get(k)
    if (exist) {
      exist.spend += spend
      exist.impressions += row.impressions ?? 0
      exist.clicks += row.clicks ?? 0
      exist.compras += r.vendas
      exist.leads += r.leads
      exist.conversas += r.conversas
    } else {
      porChave.set(k, {
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        age: row.age,
        gender: row.gender,
        spend,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        resultados: 0,
        compras: r.vendas,
        leads: r.leads,
        conversas: r.conversas,
      })
    }
  }
  return Array.from(porChave.values())
}

/** Linha do ranking de regiões (custo já calculado pela métrica escolhida). */
export type LinhaRegiao = {
  region: string
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  resultados: number // resultado da chave-herói (pode ser 0 — ver rankingDeRegioes)
  custoPorResultado: number | null
}

/** Métrica que comanda o ranking: 'heroi' = dado disponível; 'linkClicks' = fallback. */
export type MetricaRegiao = 'heroi' | 'linkClicks'

/** Ranking de regiões + qual métrica o dado permitiu usar. */
export type RankingRegioes = {
  metrica: MetricaRegiao
  linhas: LinhaRegiao[]
}

function resultadoDaChave(r: { leads: number; vendas: number; conversas: number }, chave: ChaveHeroi): number {
  if (chave === 'vendas') return r.vendas
  if (chave === 'conversas') return r.conversas
  return r.leads
}

/**
 * Agrega linhas brutas (JÁ deduplicadas) por região, somando todas as campanhas,
 * e escolhe a métrica do ranking pelo DADO DISPONÍVEL (nunca por tipo/nicho de cliente):
 *
 * - soma dos resultados da chave-herói > 0 → metrica 'heroi': ranking pela chave,
 *   custoPorResultado = spend / resultados
 * - soma = 0 → metrica 'linkClicks': ranking por cliques no link,
 *   custoPorResultado = spend / linkClicks
 *
 * Por que o fallback existe: o Meta NÃO entrega conversões de pixel (compras/leads
 * offsite) quebradas por região — limitação de privacidade da plataforma pós-iOS 14.
 * Por região só chegam link_click, page_engagement, video_view, conversas onsite e
 * lead de formulário instantâneo. Mostrar 0 sem explicação parece bug; o painel então
 * ranqueia por tráfego e avisa. Como a decisão olha o dado, o caso "lead onsite"
 * (chega → modo herói) e "lead de pixel" (não chega → fallback) se resolvem sozinhos.
 *
 * Empate é desfeito por spend desc.
 */
export function rankingDeRegioes(rows: LinhaRegiaoBruta[], chave: ChaveHeroi): RankingRegioes {
  const porRegiao = new Map<string, LinhaRegiao>()
  for (const row of rows) {
    const spend = Number(row.spend) || 0
    const r = parseActionsExtendido(row.actions)
    const resultado = resultadoDaChave(r, chave)
    const exist = porRegiao.get(row.region)
    if (exist) {
      exist.spend += spend
      exist.impressions += row.impressions ?? 0
      exist.clicks += row.clicks ?? 0
      exist.linkClicks += r.linkClicks
      exist.resultados += resultado
    } else {
      porRegiao.set(row.region, {
        region: row.region,
        spend,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        linkClicks: r.linkClicks,
        resultados: resultado,
        custoPorResultado: null,
      })
    }
  }

  const linhas = Array.from(porRegiao.values())
  const totalHeroi = linhas.reduce((soma, l) => soma + l.resultados, 0)
  const metrica: MetricaRegiao = totalHeroi > 0 ? 'heroi' : 'linkClicks'
  const valor = (l: LinhaRegiao) => (metrica === 'heroi' ? l.resultados : l.linkClicks)

  for (const l of linhas) {
    const base = valor(l)
    l.custoPorResultado = base > 0 ? l.spend / base : null
  }
  linhas.sort((a, b) => valor(b) - valor(a) || b.spend - a.spend)

  return { metrica: linhas.length === 0 ? 'heroi' : metrica, linhas }
}

// --- Objetivo da campanha (chip da tabela) ---

export type ObjetivoChip =
  | 'VENDAS'
  | 'LEADS'
  | 'CONVERSAS'
  | 'TRAFEGO'
  | 'ENGAJAMENTO'
  | 'RECONHECIMENTO'
  | 'APP'

// Objectives oficiais da Meta (atuais OUTCOME_* e legados) → rótulo do chip.
const OBJETIVO_META_PARA_CHIP: Record<string, ObjetivoChip> = {
  // Atuais (ODAX)
  OUTCOME_SALES: 'VENDAS',
  OUTCOME_LEADS: 'LEADS',
  OUTCOME_ENGAGEMENT: 'ENGAJAMENTO',
  OUTCOME_TRAFFIC: 'TRAFEGO',
  OUTCOME_AWARENESS: 'RECONHECIMENTO',
  OUTCOME_APP_PROMOTION: 'APP',
  // Legados (pré-OUTCOME)
  CONVERSIONS: 'VENDAS',
  PRODUCT_CATALOG_SALES: 'VENDAS',
  STORE_VISITS: 'VENDAS',
  LEAD_GENERATION: 'LEADS',
  MESSAGES: 'CONVERSAS',
  LINK_CLICKS: 'TRAFEGO',
  TRAFFIC: 'TRAFEGO',
  POST_ENGAGEMENT: 'ENGAJAMENTO',
  PAGE_LIKES: 'ENGAJAMENTO',
  EVENT_RESPONSES: 'ENGAJAMENTO',
  VIDEO_VIEWS: 'ENGAJAMENTO',
  BRAND_AWARENESS: 'RECONHECIMENTO',
  REACH: 'RECONHECIMENTO',
  APP_INSTALLS: 'APP',
}

// Fallback: classe do classificarObjetivo → rótulo do chip.
const CLASSE_PARA_CHIP: Record<string, ObjetivoChip> = {
  vendas: 'VENDAS',
  leads: 'LEADS',
  conversas: 'CONVERSAS',
  engajamento: 'ENGAJAMENTO',
  trafego: 'TRAFEGO',
}

/**
 * Rótulo do chip de objetivo da campanha: usa o `objective` OFICIAL da Meta
 * quando existe e é conhecido; senão cai no fallback classificarObjetivo
 * (objetivo_principal cadastrado do cliente). Retorna null quando nada resolve.
 */
export function objetivoDaCampanha(
  objectiveMeta: string | null,
  objetivoPrincipalCliente: string | null,
): ObjetivoChip | null {
  if (objectiveMeta) {
    const chip = OBJETIVO_META_PARA_CHIP[objectiveMeta.toUpperCase()]
    if (chip) return chip
  }
  const classe = classificarObjetivo(objetivoPrincipalCliente)
  return classe ? CLASSE_PARA_CHIP[classe] ?? null : null
}
