// Catálogo de métricas de tráfego + cálculos PUROS (zero import de db/auth/react),
// no padrão de @/lib/financeiro/calculos: actions e UI só consomem.
// Fonte ÚNICA da mecânica de parsing dos campos `actions`/`action_values` da Meta —
// aggregate.ts reexporta parseActions/parseActionValues daqui.

export type ActionItem = { action_type: string; value: string }

export function isActionItem(x: unknown): x is ActionItem {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { action_type?: unknown }).action_type === 'string' &&
    typeof (x as { value?: unknown }).value === 'string'
  )
}

// Mapeamento dos action_types da Meta por métrica de negócio.
// A ORDEM de cada lista é a PRIORIDADE de dedup: usamos o valor do PRIMEIRO
// action_type presente na linha, nunca somando variantes redundantes do mesmo
// evento (ex.: purchase + omni_purchase + offsite_conversion.fb_pixel_purchase).
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
const ADD_TO_CART_TYPES = [
  'omni_add_to_cart', // prioridade: consolida on/offsite
  'add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
]
const LANDING_PAGE_VIEW_TYPES = ['omni_landing_page_view', 'landing_page_view']
const ENGAJAMENTO_TYPES = ['page_engagement', 'post_engagement']
const VIDEO_VIEW_TYPES = ['video_view']

/**
 * Soma (com dedup por prioridade) os valores dos action_types de um grupo.
 * Percorre `types` na ordem de prioridade e retorna o total do PRIMEIRO
 * action_type presente na linha — evita dupla contagem entre variantes do
 * mesmo evento. Se houver o mesmo action_type repetido, soma essas ocorrências.
 */
export function somarGrupo(items: ActionItem[], types: string[]): number {
  for (const t of types) {
    const matches = items.filter((a) => a.action_type === t)
    if (matches.length > 0) {
      return matches.reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
    }
  }
  return 0
}

export type ResultadoActions = {
  leads: number
  vendas: number
  conversas: number
  linkClicks: number
}

/**
 * Extrai leads/vendas/conversas/linkClicks do campo `actions` (jsonb) da Meta.
 * Type-narrowing seguro: qualquer valor null/undefined/não-array -> tudo 0 (nunca lança).
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
 * Extrai a RECEITA total (valor monetário de compras) do campo `action_values` (jsonb).
 * Usa a mesma lógica de dedup/prioridade de VENDAS_TYPES. Retorna 0 quando não há
 * dados válidos (nunca lança).
 */
export function parseActionValues(actionValues: unknown): number {
  if (!Array.isArray(actionValues)) return 0
  const items = actionValues.filter(isActionItem)
  return somarGrupo(items, VENDAS_TYPES)
}

export type ResultadoActionsExtendido = ResultadoActions & {
  adicoesCarrinho: number
  visualizacoesLp: number
  engajamento: number
  videoViews: number
}

/**
 * Versão estendida do parseActions para o painel de campanhas: além das métricas
 * de negócio, extrai adições ao carrinho, visualizações de página de destino,
 * engajamento e visualizações de vídeo — sempre com dedup por prioridade.
 * Nulos/lixo -> tudo 0.
 */
export function parseActionsExtendido(actions: unknown): ResultadoActionsExtendido {
  const base = parseActions(actions)
  if (!Array.isArray(actions)) {
    return { ...base, adicoesCarrinho: 0, visualizacoesLp: 0, engajamento: 0, videoViews: 0 }
  }
  const items = actions.filter(isActionItem)
  return {
    ...base,
    adicoesCarrinho: somarGrupo(items, ADD_TO_CART_TYPES),
    visualizacoesLp: somarGrupo(items, LANDING_PAGE_VIEW_TYPES),
    engajamento: somarGrupo(items, ENGAJAMENTO_TYPES),
    videoViews: somarGrupo(items, VIDEO_VIEW_TYPES),
  }
}

// --- Catálogo de métricas do painel ---

export type MetricaId =
  | 'investimento'
  | 'valorEmCompras'
  | 'roas'
  | 'cpaMedio'
  | 'ticketMedio'
  | 'adicoesCarrinho'
  | 'compras'
  | 'conversas'
  | 'custoPorConversa'
  | 'leads'
  | 'custoPorLead'
  | 'impressoes'
  | 'alcance'
  | 'cliques'
  | 'cliquesNoLink'
  | 'ctrTodos'
  | 'ctrLink'
  | 'cpm'
  | 'cpcMedio'
  | 'cpcLink'
  | 'visualizacoesLp'
  | 'engajamento'
  | 'resultados'
  | 'custoPorResultado'

export type FormatoMetrica = 'moeda' | 'numero' | 'pct' | 'multiplicador'
// tipo dirige a semântica de cor do Comparar: 'custo' subindo = ruim;
// 'volume' e 'taxa' subindo = bom.
export type TipoMetrica = 'custo' | 'volume' | 'taxa'

export type MetricaCatalogo = {
  id: MetricaId
  label: string
  formato: FormatoMetrica
  tipo: TipoMetrica
}

/** Ordem PADRÃO da grade de KPIs (usada quando o cliente não tem preferências salvas). */
export const CATALOGO_METRICAS: MetricaCatalogo[] = [
  { id: 'investimento', label: 'Investimento', formato: 'moeda', tipo: 'custo' },
  { id: 'valorEmCompras', label: 'Valor em Compras', formato: 'moeda', tipo: 'volume' },
  { id: 'roas', label: 'ROAS', formato: 'multiplicador', tipo: 'taxa' },
  { id: 'cpaMedio', label: 'CPA Médio', formato: 'moeda', tipo: 'custo' },
  { id: 'ticketMedio', label: 'Ticket Médio', formato: 'moeda', tipo: 'volume' },
  { id: 'adicoesCarrinho', label: 'Adições ao carrinho', formato: 'numero', tipo: 'volume' },
  { id: 'compras', label: 'Compras', formato: 'numero', tipo: 'volume' },
  { id: 'conversas', label: 'Conversas', formato: 'numero', tipo: 'volume' },
  { id: 'custoPorConversa', label: 'Custo por Conversa', formato: 'moeda', tipo: 'custo' },
  { id: 'leads', label: 'Leads', formato: 'numero', tipo: 'volume' },
  { id: 'custoPorLead', label: 'Custo por Lead', formato: 'moeda', tipo: 'custo' },
  { id: 'impressoes', label: 'Impressões', formato: 'numero', tipo: 'volume' },
  { id: 'alcance', label: 'Alcance', formato: 'numero', tipo: 'volume' },
  { id: 'cliques', label: 'Cliques', formato: 'numero', tipo: 'volume' },
  { id: 'cliquesNoLink', label: 'Cliques no link', formato: 'numero', tipo: 'volume' },
  { id: 'ctrTodos', label: 'CTR (Todos)', formato: 'pct', tipo: 'taxa' },
  { id: 'ctrLink', label: 'CTR (Cliques no link)', formato: 'pct', tipo: 'taxa' },
  { id: 'cpm', label: 'CPM Médio', formato: 'moeda', tipo: 'custo' },
  { id: 'cpcMedio', label: 'CPC Médio', formato: 'moeda', tipo: 'custo' },
  { id: 'cpcLink', label: 'CPC Médio (No link)', formato: 'moeda', tipo: 'custo' },
  { id: 'visualizacoesLp', label: 'Visualizações de página de destino', formato: 'numero', tipo: 'volume' },
  { id: 'engajamento', label: 'Engajamento da página', formato: 'numero', tipo: 'volume' },
  { id: 'resultados', label: 'Resultados', formato: 'numero', tipo: 'volume' },
  { id: 'custoPorResultado', label: 'Custo por Resultado', formato: 'moeda', tipo: 'custo' },
]

const TIPO_POR_ID: Record<MetricaId, TipoMetrica> = Object.fromEntries(
  CATALOGO_METRICAS.map((m) => [m.id, m.tipo]),
) as Record<MetricaId, TipoMetrica>

/** Totais brutos de um período (já parseados/somados), insumo do calcularMetricas. */
export type TotaisPeriodo = {
  spend: number
  impressions: number
  clicks: number
  reach: number
  leads: number
  vendas: number
  conversas: number
  linkClicks: number
  adicoesCarrinho: number
  visualizacoesLp: number
  engajamento: number
  receita: number
  // "resultados" = resultado da chave-herói do cliente (heroiDoObjetivo).
  // Sem fallback para soma de leads+vendas+conversas — mantido simples de propósito:
  // se o herói zerou, o card mostra 0, o que é a verdade do período.
  resultadoHeroi: number
}

export function totaisVazios(): TotaisPeriodo {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    leads: 0,
    vendas: 0,
    conversas: 0,
    linkClicks: 0,
    adicoesCarrinho: 0,
    visualizacoesLp: 0,
    engajamento: 0,
    receita: 0,
    resultadoHeroi: 0,
  }
}

/** Valor de cada métrica do catálogo. Derivadas retornam null quando o denominador é 0. */
export type MetricasCalculadas = Record<MetricaId, number | null>

export function calcularMetricas(t: TotaisPeriodo): MetricasCalculadas {
  const div = (num: number, den: number): number | null => (den > 0 ? num / den : null)
  return {
    investimento: t.spend,
    valorEmCompras: t.receita,
    // Mesma semântica do getResumoCliente: sem receita OU sem spend -> null (não 0.00x)
    roas: t.receita > 0 && t.spend > 0 ? t.receita / t.spend : null,
    cpaMedio: div(t.spend, t.vendas),
    ticketMedio: div(t.receita, t.vendas),
    adicoesCarrinho: t.adicoesCarrinho,
    compras: t.vendas,
    conversas: t.conversas,
    custoPorConversa: div(t.spend, t.conversas),
    leads: t.leads,
    custoPorLead: div(t.spend, t.leads),
    impressoes: t.impressions,
    alcance: t.reach,
    cliques: t.clicks,
    cliquesNoLink: t.linkClicks,
    ctrTodos: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null,
    ctrLink: t.impressions > 0 ? (t.linkClicks / t.impressions) * 100 : null,
    cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
    cpcMedio: div(t.spend, t.clicks),
    cpcLink: div(t.spend, t.linkClicks),
    visualizacoesLp: t.visualizacoesLp,
    engajamento: t.engajamento,
    resultados: t.resultadoHeroi,
    custoPorResultado: div(t.spend, t.resultadoHeroi),
  }
}

/**
 * Variação percentual entre períodos: (atual - anterior) / anterior * 100.
 * null quando anterior é 0/null (não dá para comparar) ou atual é null.
 */
export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/**
 * Semântica de cor da variação: métricas de CUSTO subindo = ruim (vermelho);
 * volume/receita/taxa subindo = bom (verde). Delta 0 conta como "bom".
 */
export function variacaoEBoa(metricaId: MetricaId, delta: number): boolean {
  const tipo = TIPO_POR_ID[metricaId]
  if (tipo === 'custo') return delta <= 0
  return delta >= 0
}
