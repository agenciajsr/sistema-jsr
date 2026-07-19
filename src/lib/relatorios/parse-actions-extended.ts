/**
 * Parsing estendido de actions/action_values da Meta para relatórios.
 * Complementa o parse básico de aggregate.ts com métricas adicionais
 * necessárias para o relatório semanal (add_to_cart, checkout, landing_page_view).
 */

type ActionItem = { action_type: string; value: string }

function isActionItem(x: unknown): x is ActionItem {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { action_type?: unknown }).action_type === 'string' &&
    typeof (x as { value?: unknown }).value === 'string'
  )
}

function somarGrupo(items: ActionItem[], types: string[]): number {
  for (const t of types) {
    const matches = items.filter((a) => a.action_type === t)
    if (matches.length > 0) {
      return matches.reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
    }
  }
  return 0
}

// --- Action types por métrica ---

const COMPRAS_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_conversion.purchase',
]

const LEADS_TYPES = [
  'lead',
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
]

const CONVERSAS_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.total_messaging_connection',
]

const ADD_TO_CART_TYPES = [
  'offsite_conversion.fb_pixel_add_to_cart',
  'omni_add_to_cart',
  'add_to_cart',
]

const CHECKOUT_TYPES = [
  'offsite_conversion.fb_pixel_initiate_checkout',
  'omni_initiated_checkout',
  'initiate_checkout',
]

const LANDING_PAGE_VIEW_TYPES = [
  'landing_page_view',
]

const LINK_CLICK_TYPES = ['link_click']

const VIDEO_VIEW_TYPES = ['video_view']

const CURTIDAS_PAGINA_TYPES = ['like']

const ENGAJAMENTO_TYPES = [
  'post_engagement',
  'page_engagement',
  'post_reaction',
  'comment',
  'post',
]

export type MetricasRelatorio = {
  compras: number
  leads: number
  conversas: number
  addToCart: number
  checkout: number
  landingPageView: number
  linkClicks: number
  engajamento: number
  videoViews: number
  curtidasPagina: number
  receita: number
}

/**
 * Extrai TODAS as métricas relevantes para o relatório de uma lista de actions.
 */
export function parseActionsRelatorio(actions: unknown): Omit<MetricasRelatorio, 'receita'> {
  if (!Array.isArray(actions)) {
    return { compras: 0, leads: 0, conversas: 0, addToCart: 0, checkout: 0, landingPageView: 0, linkClicks: 0, engajamento: 0, videoViews: 0, curtidasPagina: 0 }
  }
  const items = actions.filter(isActionItem)
  return {
    compras: somarGrupo(items, COMPRAS_TYPES),
    leads: somarGrupo(items, LEADS_TYPES),
    conversas: somarGrupo(items, CONVERSAS_TYPES),
    addToCart: somarGrupo(items, ADD_TO_CART_TYPES),
    checkout: somarGrupo(items, CHECKOUT_TYPES),
    landingPageView: somarGrupo(items, LANDING_PAGE_VIEW_TYPES),
    linkClicks: somarGrupo(items, LINK_CLICK_TYPES),
    engajamento: somarGrupo(items, ENGAJAMENTO_TYPES),
    videoViews: somarGrupo(items, VIDEO_VIEW_TYPES),
    curtidasPagina: somarGrupo(items, CURTIDAS_PAGINA_TYPES),
  }
}

/**
 * Extrai receita (valor monetário) do campo action_values.
 */
export function parseReceitaRelatorio(actionValues: unknown): number {
  if (!Array.isArray(actionValues)) return 0
  const items = actionValues.filter(isActionItem)
  return somarGrupo(items, COMPRAS_TYPES)
}
