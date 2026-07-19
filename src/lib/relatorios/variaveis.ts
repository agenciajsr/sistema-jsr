/**
 * Catálogo de variáveis dos relatórios configuráveis + interpolação de templates.
 * Módulo PURO — zero imports de db/auth/react (testável com Vitest).
 */

export type FormatoVariavel = 'moeda' | 'numero' | 'percent' | 'roas' | 'texto'

export type CategoriaVariavel =
  | 'gerais'
  | 'investimento'
  | 'cliques'
  | 'leads'
  | 'conversas'
  | 'vendas'
  | 'pagina'
  | 'engajamento'
  | 'video'

export type VariavelCatalogo = {
  chave: string
  label: string
  categoria: CategoriaVariavel
  formato: FormatoVariavel
}

export const CATALOGO_VARIAVEIS: VariavelCatalogo[] = [
  // Gerais
  { chave: 'cliente', label: 'Nome do cliente', categoria: 'gerais', formato: 'texto' },
  { chave: 'conta', label: 'Nome da conta', categoria: 'gerais', formato: 'texto' },
  { chave: 'date_range', label: 'Período (DD/MM a DD/MM)', categoria: 'gerais', formato: 'texto' },
  { chave: 'periodo_inicio', label: 'Início do período', categoria: 'gerais', formato: 'texto' },
  { chave: 'periodo_fim', label: 'Fim do período', categoria: 'gerais', formato: 'texto' },
  // Investimento
  { chave: 'investimento', label: 'Investimento', categoria: 'investimento', formato: 'moeda' },
  { chave: 'cpm', label: 'CPM', categoria: 'investimento', formato: 'moeda' },
  // Cliques / alcance
  { chave: 'cliques', label: 'Cliques', categoria: 'cliques', formato: 'numero' },
  { chave: 'ctr', label: 'CTR', categoria: 'cliques', formato: 'percent' },
  { chave: 'cpc', label: 'CPC', categoria: 'cliques', formato: 'moeda' },
  { chave: 'impressoes', label: 'Impressões', categoria: 'cliques', formato: 'numero' },
  { chave: 'alcance', label: 'Alcance', categoria: 'cliques', formato: 'numero' },
  // Leads
  { chave: 'leads', label: 'Leads', categoria: 'leads', formato: 'numero' },
  { chave: 'cpl', label: 'CPL (custo por lead)', categoria: 'leads', formato: 'moeda' },
  // Conversas
  { chave: 'conversas', label: 'Conversas iniciadas', categoria: 'conversas', formato: 'numero' },
  { chave: 'custo_por_conversa', label: 'Custo por conversa', categoria: 'conversas', formato: 'moeda' },
  // Vendas
  { chave: 'compras', label: 'Compras', categoria: 'vendas', formato: 'numero' },
  { chave: 'receita', label: 'Receita (valor em vendas)', categoria: 'vendas', formato: 'moeda' },
  { chave: 'roas', label: 'ROAS', categoria: 'vendas', formato: 'roas' },
  { chave: 'cpv', label: 'CPV (custo por venda)', categoria: 'vendas', formato: 'moeda' },
  { chave: 'ticket_medio', label: 'Ticket médio', categoria: 'vendas', formato: 'moeda' },
  { chave: 'add_to_cart', label: 'Adições ao carrinho', categoria: 'vendas', formato: 'numero' },
  { chave: 'checkout', label: 'Checkouts iniciados', categoria: 'vendas', formato: 'numero' },
  // Página
  { chave: 'visitas_pagina', label: 'Visitas à página', categoria: 'pagina', formato: 'numero' },
  { chave: 'custo_por_visita', label: 'Custo por visita', categoria: 'pagina', formato: 'moeda' },
  // Engajamento
  { chave: 'engajamento', label: 'Engajamento', categoria: 'engajamento', formato: 'numero' },
  { chave: 'custo_por_engajamento', label: 'Custo por engajamento', categoria: 'engajamento', formato: 'moeda' },
  { chave: 'cliques_link', label: 'Cliques no link', categoria: 'engajamento', formato: 'numero' },
  { chave: 'custo_por_clique_link', label: 'Custo por clique no link', categoria: 'engajamento', formato: 'moeda' },
  { chave: 'curtidas_pagina', label: 'Curtidas da página', categoria: 'engajamento', formato: 'numero' },
  // Vídeo
  { chave: 'video_views', label: 'Visualizações de vídeo', categoria: 'video', formato: 'numero' },
  { chave: 'custo_por_video_view', label: 'Custo por visualização', categoria: 'video', formato: 'moeda' },
]

export const LABELS_CATEGORIA: Record<CategoriaVariavel, string> = {
  gerais: 'Gerais',
  investimento: 'Investimento',
  cliques: 'Cliques e alcance',
  leads: 'Leads',
  conversas: 'Conversas',
  vendas: 'Vendas',
  pagina: 'Página',
  engajamento: 'Engajamento',
  video: 'Vídeo',
}

// Linha pronta de mensagem para cada métrica (usada para compor a mensagem do
// bloco automaticamente a partir das métricas marcadas na UI).
export const LINHAS_METRICAS: Record<string, string> = {
  investimento: '💸 *Investimento:* {{investimento}}',
  cpm: '📊 *CPM:* {{cpm}}',
  cliques: '🖱 *Cliques:* {{cliques}}',
  ctr: '🎯 *CTR:* {{ctr}}',
  cpc: '💰 *CPC:* {{cpc}}',
  impressoes: '👁 *Impressões:* {{impressoes}}',
  alcance: '👥 *Alcance:* {{alcance}}',
  leads: '📋 *Leads:* {{leads}}',
  cpl: '💰 *Custo por lead:* {{cpl}}',
  conversas: '💬 *Conversas iniciadas:* {{conversas}}',
  custo_por_conversa: '💰 *Custo por conversa:* {{custo_por_conversa}}',
  compras: '🛍 *Compras:* {{compras}}',
  receita: '💵 *Receita:* {{receita}}',
  roas: '📈 *ROAS:* {{roas}}',
  cpv: '💵 *Custo por venda:* {{cpv}}',
  ticket_medio: '🎫 *Ticket médio:* {{ticket_medio}}',
  add_to_cart: '🛒 *Adições ao carrinho:* {{add_to_cart}}',
  checkout: '💳 *Checkouts iniciados:* {{checkout}}',
  visitas_pagina: '📄 *Visitas à página:* {{visitas_pagina}}',
  custo_por_visita: '💰 *Custo por visita:* {{custo_por_visita}}',
  engajamento: '🤝 *Engajamento:* {{engajamento}}',
  custo_por_engajamento: '💰 *Custo por engajamento:* {{custo_por_engajamento}}',
  cliques_link: '🔗 *Cliques no link:* {{cliques_link}}',
  custo_por_clique_link: '💰 *Custo por clique no link:* {{custo_por_clique_link}}',
  curtidas_pagina: '👍 *Curtidas da página:* {{curtidas_pagina}}',
  video_views: '🎬 *Visualizações de vídeo:* {{video_views}}',
  custo_por_video_view: '💰 *Custo por visualização:* {{custo_por_video_view}}',
}

/**
 * Monta a mensagem de um bloco a partir das métricas marcadas, na ordem do
 * catálogo, com o nome da conta no topo.
 */
export function montarMensagemDeMetricas(chaves: string[]): string {
  const selecionadas = new Set(chaves)
  const linhas = CATALOGO_VARIAVEIS
    .filter((v) => selecionadas.has(v.chave) && LINHAS_METRICAS[v.chave])
    .map((v) => LINHAS_METRICAS[v.chave])
  return ['🏦 *{{conta}}*', ...linhas].join('\n')
}

// Sinônimos em <MAIÚSCULA> aceitos além de {{chave}} (compatível com refs visuais).
const ALIAS_MAIUSCULA: Record<string, string> = {
  DATA: 'date_range',
  CLIENTE: 'cliente',
  CONTA: 'conta',
  INVESTIMENTO: 'investimento',
  LEADS: 'leads',
  CONVERSAS: 'conversas',
  COMPRAS: 'compras',
  RECEITA: 'receita',
  ROAS: 'roas',
}

/** Contexto de valores já calculados para interpolação. */
export type ContextoVariaveis = Record<string, number | string | null | undefined>

// --- Formatação pt-BR ---

export function fmtMoedaBR(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtNumeroBR(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

export function fmtPercentBR(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function fmtRoasBR(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
}

function formatarValor(chave: string, valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'string') return valor

  const item = CATALOGO_VARIAVEIS.find((v) => v.chave === chave)
  switch (item?.formato) {
    case 'moeda': return fmtMoedaBR(valor)
    case 'percent': return fmtPercentBR(valor)
    case 'roas': return fmtRoasBR(valor)
    case 'numero': return fmtNumeroBR(valor)
    default: return String(valor)
  }
}

/**
 * Substitui {{chave}} (e aliases <MAIÚSCULA>) pelos valores do contexto,
 * formatados em pt-BR. Variável desconhecida ou sem valor vira "—" — nunca lança.
 */
export function interpolarVariaveis(template: string, contexto: ContextoVariaveis): string {
  const comAliases = template.replace(/<([A-ZÀ-Ü_]+)>/g, (match, alias: string) => {
    const chave = ALIAS_MAIUSCULA[alias]
    return chave ? `{{${chave}}}` : match
  })

  return comAliases.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, chave: string) => {
    return formatarValor(chave, contexto[chave])
  })
}
