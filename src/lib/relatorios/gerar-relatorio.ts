/**
 * Lógica central de geração de relatório semanal.
 * Agrega dados por conta de anúncio + consolidado, formatado para WhatsApp.
 */

import { eq, and, gte, lte, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights, clientes } from '@/lib/db/schema'
import { dataMenosDias } from '@/lib/date-br'
import { classificarObjetivo } from '@/lib/trafego/aggregate'
import { parseActionsRelatorio, parseReceitaRelatorio, type MetricasRelatorio } from './parse-actions-extended'

// --- Tipos ---

export type ObjetivoCliente = 'compras' | 'leads' | 'leads_formulario' | 'whatsapp' | 'engajamento' | 'trafego'

export type MetricasConta = {
  contaId: string
  contaNome: string
  spend: number
  reach: number
  impressions: number
  clicks: number
  landingPageView: number
  addToCart: number
  checkout: number
  compras: number
  leads: number
  conversas: number
  engajamento: number
  linkClicks: number
  receita: number
  // Derivadas
  roas: number | null
  cpv: number | null
  cpl: number | null
  cpConv: number | null
  ticketMedio: number | null
  cpm: number | null
  ctr: number | null
  taxaCheckoutCompra: number | null
}

export type RelatorioGerado = {
  clienteId: string
  clienteNome: string
  objetivo: ObjetivoCliente
  periodoInicio: string // YYYY-MM-DD
  periodoFim: string // YYYY-MM-DD
  contas: MetricasConta[]
  consolidado: MetricasConta
  totalContas: number
  totalCampanhas: number
  textoWhatsapp: string
  geradoEm: string // ISO timestamp
}

// --- Mapear nicho/objetivo do cliente ---

function detectarObjetivo(cliente: { nicho: string; objetivoPrincipal: string | null }): ObjetivoCliente {
  // Mesma classificação usada em Painel/Campanhas (fonte única), para todos concordarem.
  const classe = classificarObjetivo(cliente.objetivoPrincipal)
  const obj = (cliente.objetivoPrincipal ?? '').toLowerCase()
  if (classe === 'vendas') return 'compras'
  if (classe === 'leads') return /formul/.test(obj) ? 'leads_formulario' : 'leads'
  if (classe === 'conversas') return 'whatsapp'
  if (classe === 'engajamento') return 'engajamento'
  if (classe === 'trafego') return 'trafego'

  // Fallback pelo nicho quando o texto não classifica.
  switch (cliente.nicho) {
    case 'ecommerce': return 'compras'
    case 'negocio_local': return 'whatsapp'
    case 'infoproduto': return 'leads'
    default: return 'leads'
  }
}

// --- Agregação por conta ---

/**
 * Agrega campaign_insights de UMA conta no período (opcionalmente filtrando
 * campanhas específicas). Retorna null quando não há dados.
 * Reutilizada pelo fluxo legado e pelos relatórios configuráveis.
 */
export async function agregarContaPeriodo(
  conta: { id: string; nome: string },
  dataInicio: string,
  dataFim: string,
  campanhaIds?: string[],
): Promise<{ metricas: MetricasConta; totalCampanhas: number } | null> {
  const filtros = [
    eq(campaignInsights.adAccountId, conta.id),
    gte(campaignInsights.date, dataInicio),
    lte(campaignInsights.date, dataFim),
  ]
  if (campanhaIds && campanhaIds.length > 0) {
    filtros.push(inArray(campaignInsights.campaignId, campanhaIds))
  }

  const rows = await db
    .select({
      campaignId: campaignInsights.campaignId,
      spend: campaignInsights.spend,
      impressions: campaignInsights.impressions,
      clicks: campaignInsights.clicks,
      reach: campaignInsights.reach,
      actions: campaignInsights.actions,
      actionValues: campaignInsights.actionValues,
    })
    .from(campaignInsights)
    .where(and(...filtros))

  if (rows.length === 0) return null

  const campanhasUnicas = new Set(rows.map((r) => r.campaignId))

  let spend = 0, reach = 0, impressions = 0, clicks = 0
  let compras = 0, leads = 0, conversas = 0, addToCart = 0, checkout = 0
  let landingPageView = 0, linkClicks = 0, engajamento = 0, receita = 0

  for (const row of rows) {
    spend += Number(row.spend) || 0
    reach += row.reach ?? 0
    impressions += row.impressions ?? 0
    clicks += row.clicks ?? 0

    const metrics = parseActionsRelatorio(row.actions)
    compras += metrics.compras
    leads += metrics.leads
    conversas += metrics.conversas
    addToCart += metrics.addToCart
    checkout += metrics.checkout
    landingPageView += metrics.landingPageView
    linkClicks += metrics.linkClicks
    engajamento += metrics.engajamento
    receita += parseReceitaRelatorio(row.actionValues)
  }

  const metricas: MetricasConta = {
    contaId: conta.id,
    contaNome: conta.nome,
    spend,
    reach,
    impressions,
    clicks,
    landingPageView,
    addToCart,
    checkout,
    compras,
    leads,
    conversas,
    engajamento,
    linkClicks,
    receita,
    roas: spend > 0 && receita > 0 ? receita / spend : null,
    cpv: compras > 0 ? spend / compras : null,
    cpl: leads > 0 ? spend / leads : null,
    cpConv: conversas > 0 ? spend / conversas : null,
    ticketMedio: compras > 0 ? receita / compras : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    taxaCheckoutCompra: checkout > 0 && compras > 0 ? (compras / checkout) * 100 : null,
  }

  return { metricas, totalCampanhas: campanhasUnicas.size }
}

async function agregarPorConta(
  contasDb: { id: string; nome: string }[],
  dataInicio: string,
  dataFim: string,
): Promise<{ contas: MetricasConta[]; totalCampanhas: number }> {
  const resultado: MetricasConta[] = []
  let totalCampanhas = 0

  // Queries sequenciais de propósito (pool pequeno em serverless).
  for (const conta of contasDb) {
    const agregado = await agregarContaPeriodo(conta, dataInicio, dataFim)
    if (!agregado) continue
    resultado.push(agregado.metricas)
    totalCampanhas += agregado.totalCampanhas
  }

  return { contas: resultado, totalCampanhas }
}

function consolidarContas(contas: MetricasConta[]): MetricasConta {
  const c: MetricasConta = {
    contaId: 'consolidado',
    contaNome: 'Consolidado',
    spend: 0, reach: 0, impressions: 0, clicks: 0,
    landingPageView: 0, addToCart: 0, checkout: 0,
    compras: 0, leads: 0, conversas: 0, engajamento: 0, linkClicks: 0, receita: 0,
    roas: null, cpv: null, cpl: null, cpConv: null, ticketMedio: null,
    cpm: null, ctr: null, taxaCheckoutCompra: null,
  }

  for (const conta of contas) {
    c.spend += conta.spend
    c.reach += conta.reach
    c.impressions += conta.impressions
    c.clicks += conta.clicks
    c.landingPageView += conta.landingPageView
    c.addToCart += conta.addToCart
    c.checkout += conta.checkout
    c.compras += conta.compras
    c.leads += conta.leads
    c.conversas += conta.conversas
    c.engajamento += conta.engajamento
    c.linkClicks += conta.linkClicks
    c.receita += conta.receita
  }

  // Derivadas consolidadas
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

// --- Entry point ---

export async function gerarRelatorioCliente(
  clienteId: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<RelatorioGerado | null> {
  // Defaults: últimos 7 dias (seg anterior → dom anterior)
  const fim = dataFim ?? dataMenosDias(1) // ontem (domingo)
  const inicio = dataInicio ?? dataMenosDias(7) // 7 dias atrás (segunda)

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, clienteId),
    columns: { id: true, nome: true, nicho: true, objetivoPrincipal: true },
  })

  if (!cliente) return null

  const contasDb = await db
    .select({ id: adAccounts.id, nome: adAccounts.nome })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
        eq(adAccounts.plataforma, 'meta'),
        eq(adAccounts.ativo, true),
      ),
    )

  if (contasDb.length === 0) return null

  const objetivo = detectarObjetivo({ nicho: cliente.nicho, objetivoPrincipal: cliente.objetivoPrincipal })
  const { contas, totalCampanhas } = await agregarPorConta(contasDb, inicio, fim)

  if (contas.length === 0) return null

  const consolidado = consolidarContas(contas)

  const { formatarRelatorioWhatsapp } = await import('./templates-whatsapp')
  const textoWhatsapp = formatarRelatorioWhatsapp({
    clienteNome: cliente.nome,
    objetivo,
    periodoInicio: inicio,
    periodoFim: fim,
    contas,
    consolidado,
    totalCampanhas,
  })

  return {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    objetivo,
    periodoInicio: inicio,
    periodoFim: fim,
    contas,
    consolidado,
    totalContas: contas.length,
    totalCampanhas,
    textoWhatsapp,
    geradoEm: new Date().toISOString(),
  }
}
