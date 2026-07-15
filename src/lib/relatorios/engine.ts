/**
 * Engine pura dos relatórios configuráveis: cálculo de período, agendamento
 * (devidoHoje/proximoEnvio), compilado e montagem do texto final.
 * Módulo PURO — zero imports de db/auth/react (testável com Vitest).
 */

import type { MetricasConta } from './gerar-relatorio'
import { interpolarVariaveis, type ContextoVariaveis } from './variaveis'

// --- Tipos ---

export type FrequenciaRelatorio = 'semanal' | 'mensal'

export type RelatorioConfigInput = {
  nome: string
  frequencia: FrequenciaRelatorio
  diaSemana: number | null // 0-6 (domingo-sábado), quando semanal
  diaMes: number | null // 1-31, quando mensal
  periodoDias: number | null // null = padrão da frequência
  cabecalho: string
  incluirCompilado: boolean
  mensagemCompilado: string | null
  ativo: boolean
}

export type BlocoRelatorio = {
  ordem: number
  mensagem: string
  metricas: string[]
}

export type BlocoComMetricas = {
  bloco: BlocoRelatorio
  metricas: MetricasConta
}

export type Periodo = { inicio: string; fim: string } // YYYY-MM-DD

// --- Helpers de data (puros, âncora meio-dia UTC para evitar bordas de fuso) ---

function paraDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`)
}

function paraYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function menosDias(ymd: string, n: number): string {
  const d = paraDate(ymd)
  d.setUTCDate(d.getUTCDate() - n)
  return paraYMD(d)
}

function diaDaSemana(ymd: string): number {
  return paraDate(ymd).getUTCDay()
}

function ultimoDiaDoMes(ano: number, mesIndex0: number): number {
  return new Date(Date.UTC(ano, mesIndex0 + 1, 0, 12)).getUTCDate()
}

// --- Período dos dados ---

/**
 * Período coberto pelo relatório gerado em `hoje` (sem contar o dia do envio):
 * - semanal: últimos `periodoDias` (default 7) dias completos → envio na segunda
 *   com 7 dias cobre segunda a domingo ANTERIORES.
 * - mensal com periodoDias definido: últimos N dias completos.
 * - mensal sem periodoDias: mês anterior completo (1º ao último dia).
 */
export function calcularPeriodo(
  config: Pick<RelatorioConfigInput, 'frequencia' | 'periodoDias'>,
  hoje: string,
): Periodo {
  if (config.frequencia === 'mensal' && config.periodoDias == null) {
    const d = paraDate(hoje)
    const ano = d.getUTCFullYear()
    const mes = d.getUTCMonth() // 0-11
    const anoAnterior = mes === 0 ? ano - 1 : ano
    const mesAnterior = mes === 0 ? 11 : mes - 1
    const ultimo = ultimoDiaDoMes(anoAnterior, mesAnterior)
    const mm = String(mesAnterior + 1).padStart(2, '0')
    return {
      inicio: `${anoAnterior}-${mm}-01`,
      fim: `${anoAnterior}-${mm}-${String(ultimo).padStart(2, '0')}`,
    }
  }

  const dias = config.periodoDias ?? 7
  return { inicio: menosDias(hoje, dias), fim: menosDias(hoje, 1) }
}

// --- Agendamento ---

/**
 * A config deve gerar relatório em `hoje`?
 * - inativa: nunca.
 * - semanal: apenas no diaSemana configurado.
 * - mensal: apenas no diaMes configurado; diaMes maior que o último dia do mês
 *   grampeia para o último dia (ex.: diaMes 31 em fevereiro → dia 28/29).
 */
export function devidoHoje(
  config: Pick<RelatorioConfigInput, 'frequencia' | 'diaSemana' | 'diaMes' | 'ativo'>,
  hoje: string,
): boolean {
  if (!config.ativo) return false

  if (config.frequencia === 'semanal') {
    if (config.diaSemana == null) return false
    return diaDaSemana(hoje) === config.diaSemana
  }

  if (config.diaMes == null) return false
  const d = paraDate(hoje)
  const ultimo = ultimoDiaDoMes(d.getUTCFullYear(), d.getUTCMonth())
  const alvo = Math.min(config.diaMes, ultimo)
  return d.getUTCDate() === alvo
}

/**
 * Próxima data (YYYY-MM-DD) em que a config será devida, projetando até 60 dias
 * a partir de `hoje` (inclusive). null se inativa ou sem dia configurado.
 */
export function proximoEnvio(
  config: Pick<RelatorioConfigInput, 'frequencia' | 'diaSemana' | 'diaMes' | 'ativo'>,
  hoje: string,
): string | null {
  if (!config.ativo) return null
  let data = hoje
  for (let i = 0; i < 62; i++) {
    if (devidoHoje(config, data)) return data
    data = menosDias(data, -1)
  }
  return null
}

// --- Compilado ---

/** Soma métricas brutas de N blocos e recalcula derivadas (mesma matemática do consolidado). */
export function compilarBlocos(metricasPorBloco: MetricasConta[]): MetricasConta {
  const c: MetricasConta = {
    contaId: 'compilado',
    contaNome: 'Resumo Compilado',
    spend: 0, reach: 0, impressions: 0, clicks: 0,
    landingPageView: 0, addToCart: 0, checkout: 0,
    compras: 0, leads: 0, conversas: 0, engajamento: 0, linkClicks: 0, receita: 0,
    roas: null, cpv: null, cpl: null, cpConv: null, ticketMedio: null,
    cpm: null, ctr: null, taxaCheckoutCompra: null,
  }

  for (const m of metricasPorBloco) {
    c.spend += m.spend
    c.reach += m.reach
    c.impressions += m.impressions
    c.clicks += m.clicks
    c.landingPageView += m.landingPageView
    c.addToCart += m.addToCart
    c.checkout += m.checkout
    c.compras += m.compras
    c.leads += m.leads
    c.conversas += m.conversas
    c.engajamento += m.engajamento
    c.linkClicks += m.linkClicks
    c.receita += m.receita
  }

  c.roas = c.spend > 0 && c.receita > 0 ? c.receita / c.spend : null
  c.cpv = c.compras > 0 ? c.spend / c.compras : null
  c.cpl = c.leads > 0 ? c.spend / c.leads : null
  c.cpConv = c.conversas > 0 ? c.spend / c.conversas : null
  c.ticketMedio = c.compras > 0 ? c.receita / c.compras : null
  c.cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null
  c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null
  c.taxaCheckoutCompra = c.checkout > 0 && c.compras > 0 ? (c.compras / c.checkout) * 100 : null

  return c
}

// --- Contexto de variáveis a partir de MetricasConta ---

function fmtDataBR(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${d}/${m}`
}

export function contextoDeMetricas(
  m: MetricasConta,
  extras: { clienteNome?: string; periodo?: Periodo } = {},
): ContextoVariaveis {
  return {
    cliente: extras.clienteNome ?? null,
    conta: m.contaNome,
    date_range: extras.periodo ? `${fmtDataBR(extras.periodo.inicio)} a ${fmtDataBR(extras.periodo.fim)}` : null,
    periodo_inicio: extras.periodo ? fmtDataBR(extras.periodo.inicio) : null,
    periodo_fim: extras.periodo ? fmtDataBR(extras.periodo.fim) : null,
    investimento: m.spend,
    cpm: m.cpm,
    cliques: m.clicks,
    ctr: m.ctr,
    cpc: m.clicks > 0 ? m.spend / m.clicks : null,
    impressoes: m.impressions,
    alcance: m.reach,
    leads: m.leads,
    cpl: m.cpl,
    conversas: m.conversas,
    custo_por_conversa: m.cpConv,
    compras: m.compras,
    receita: m.receita,
    roas: m.roas,
    cpv: m.cpv,
    ticket_medio: m.ticketMedio,
    add_to_cart: m.addToCart,
    checkout: m.checkout,
    visitas_pagina: m.landingPageView,
    custo_por_visita: m.landingPageView > 0 ? m.spend / m.landingPageView : null,
  }
}

// --- Montagem do texto final ---

/**
 * Monta o texto do relatório: cabeçalho interpolado + N blocos (mensagem de cada
 * bloco interpolada com as métricas da sua conta) + Resumo Compilado opcional.
 */
export function montarTextoRelatorio(
  config: Pick<RelatorioConfigInput, 'cabecalho' | 'incluirCompilado' | 'mensagemCompilado'>,
  blocos: BlocoComMetricas[],
  periodo: Periodo,
  clienteNome: string,
): string {
  const sections: string[] = []

  const contextoGeral: ContextoVariaveis = {
    ...contextoDeMetricas(compilarBlocos(blocos.map((b) => b.metricas)), { clienteNome, periodo }),
    conta: null, // cabeçalho não é de uma conta específica
    cliente: clienteNome,
  }
  sections.push(interpolarVariaveis(config.cabecalho, contextoGeral).trim())

  const ordenados = [...blocos].sort((a, b) => a.bloco.ordem - b.bloco.ordem)
  for (const { bloco, metricas } of ordenados) {
    const ctx = contextoDeMetricas(metricas, { clienteNome, periodo })
    sections.push(interpolarVariaveis(bloco.mensagem, ctx).trim())
  }

  if (config.incluirCompilado && blocos.length > 1) {
    const compilado = compilarBlocos(blocos.map((b) => b.metricas))
    const ctx = contextoDeMetricas(compilado, { clienteNome, periodo })
    const template = config.mensagemCompilado?.trim()
      ? config.mensagemCompilado
      : [
          '📌 Resumo Compilado',
          '💸 Investimento total: {{investimento}}',
          '📋 Leads: {{leads}} | 💬 Conversas: {{conversas}}',
          '🛍 Compras: {{compras}} | 💵 Receita: {{receita}}',
          '📈 ROAS: {{roas}}',
        ].join('\n')
    sections.push(interpolarVariaveis(template, ctx).trim())
  }

  return sections.filter(Boolean).join('\n\n')
}
