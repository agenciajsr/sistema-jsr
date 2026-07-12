/**
 * Templates de formatação de relatório para WhatsApp.
 * Gera texto com emojis e formatação pronta para copiar e colar.
 */

import type { MetricasConta, ObjetivoCliente } from './gerar-relatorio'

type TemplateInput = {
  clienteNome: string
  objetivo: ObjetivoCliente
  periodoInicio: string // YYYY-MM-DD
  periodoFim: string // YYYY-MM-DD
  contas: MetricasConta[]
  consolidado: MetricasConta
  totalCampanhas: number
}

// --- Helpers de formatação ---

function fmtMoeda(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtNumero(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

function fmtPercent(valor: number): string {
  return `${valor.toFixed(1)}%`
}

function fmtRoas(valor: number): string {
  return `${valor.toFixed(2)}x`
}

function fmtData(dateStr: string): string {
  // YYYY-MM-DD → DD/MM
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function labelObjetivo(objetivo: ObjetivoCliente): string {
  switch (objetivo) {
    case 'compras': return 'Compras no site'
    case 'leads': return 'Geração de Leads'
    case 'leads_formulario': return 'Leads por Formulário'
    case 'whatsapp': return 'Conversas no WhatsApp'
    case 'engajamento': return 'Engajamento'
    case 'trafego': return 'Tráfego para o site'
  }
}

// --- Bloco de métricas por conta (varia por objetivo) ---

function blocoContaCompras(conta: MetricasConta, idx: number): string {
  const lines: string[] = []
  lines.push(`🏦 Conta ${idx + 1}`)
  lines.push(`💸 Investimento: ${fmtMoeda(conta.spend)}`)
  lines.push(`👥 Alcance: ${fmtNumero(conta.reach)}`)
  lines.push(`👁 Impressões: ${fmtNumero(conta.impressions)}`)
  lines.push(`🖱 Cliques: ${fmtNumero(conta.clicks)} | 📄 Página: ${fmtNumero(conta.landingPageView)}`)
  lines.push(`🛒 Add to Cart: ${fmtNumero(conta.addToCart)} | 💳 Checkout: ${fmtNumero(conta.checkout)}`)
  lines.push(`🛍 Compras: ${fmtNumero(conta.compras)}`)
  lines.push(`💵 Valor em vendas: ${fmtMoeda(conta.receita)}`)
  if (conta.roas) lines.push(`📈 ROAS: ${fmtRoas(conta.roas)}`)
  if (conta.cpv) lines.push(`💵 CPV: ${fmtMoeda(conta.cpv)} | 🎫 Ticket médio: ${fmtMoeda(conta.ticketMedio ?? 0)}`)
  if (conta.cpm) lines.push(`📊 CPM: ${fmtMoeda(conta.cpm)} | 📈 CTR: ${fmtPercent(conta.ctr ?? 0)}`)
  if (conta.taxaCheckoutCompra) lines.push(`📊 Taxa checkout → compra: ${fmtPercent(conta.taxaCheckoutCompra)}`)
  return lines.join('\n')
}

function blocoContaLeads(conta: MetricasConta, idx: number): string {
  const lines: string[] = []
  lines.push(`🏦 Conta ${idx + 1}`)
  lines.push(`💸 Investimento: ${fmtMoeda(conta.spend)}`)
  lines.push(`👥 Alcance: ${fmtNumero(conta.reach)}`)
  lines.push(`👁 Impressões: ${fmtNumero(conta.impressions)}`)
  lines.push(`🖱 Cliques: ${fmtNumero(conta.clicks)} | 📄 Página: ${fmtNumero(conta.landingPageView)}`)
  lines.push(`📋 Leads: ${fmtNumero(conta.leads)}`)
  if (conta.cpl) lines.push(`💰 CPL: ${fmtMoeda(conta.cpl)}`)
  if (conta.cpm) lines.push(`📊 CPM: ${fmtMoeda(conta.cpm)} | 📈 CTR: ${fmtPercent(conta.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoContaWhatsapp(conta: MetricasConta, idx: number): string {
  const lines: string[] = []
  lines.push(`🏦 Conta ${idx + 1}`)
  lines.push(`💸 Investimento: ${fmtMoeda(conta.spend)}`)
  lines.push(`👥 Alcance: ${fmtNumero(conta.reach)}`)
  lines.push(`👁 Impressões: ${fmtNumero(conta.impressions)}`)
  lines.push(`🖱 Cliques: ${fmtNumero(conta.clicks)} | 📄 Página: ${fmtNumero(conta.landingPageView)}`)
  lines.push(`💬 Conversas iniciadas: ${fmtNumero(conta.conversas)}`)
  if (conta.cpConv) lines.push(`💰 Custo por conversa: ${fmtMoeda(conta.cpConv)}`)
  if (conta.cpm) lines.push(`📊 CPM: ${fmtMoeda(conta.cpm)} | 📈 CTR: ${fmtPercent(conta.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoContaEngajamento(conta: MetricasConta, idx: number): string {
  const lines: string[] = []
  lines.push(`🏦 Conta ${idx + 1}`)
  lines.push(`💸 Investimento: ${fmtMoeda(conta.spend)}`)
  lines.push(`👥 Alcance: ${fmtNumero(conta.reach)}`)
  lines.push(`👁 Impressões: ${fmtNumero(conta.impressions)}`)
  lines.push(`🖱 Cliques: ${fmtNumero(conta.clicks)}`)
  lines.push(`❤️ Engajamento: ${fmtNumero(conta.engajamento)}`)
  if (conta.engajamento > 0) lines.push(`💰 Custo por engajamento: ${fmtMoeda(conta.spend / conta.engajamento)}`)
  if (conta.cpm) lines.push(`📊 CPM: ${fmtMoeda(conta.cpm)} | 📈 CTR: ${fmtPercent(conta.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoContaTrafego(conta: MetricasConta, idx: number): string {
  const lines: string[] = []
  lines.push(`🏦 Conta ${idx + 1}`)
  lines.push(`💸 Investimento: ${fmtMoeda(conta.spend)}`)
  lines.push(`👥 Alcance: ${fmtNumero(conta.reach)}`)
  lines.push(`👁 Impressões: ${fmtNumero(conta.impressions)}`)
  lines.push(`🖱 Cliques: ${fmtNumero(conta.clicks)} | 📄 Página: ${fmtNumero(conta.landingPageView)}`)
  if (conta.landingPageView > 0) lines.push(`💰 Custo por visita: ${fmtMoeda(conta.spend / conta.landingPageView)}`)
  if (conta.cpm) lines.push(`📊 CPM: ${fmtMoeda(conta.cpm)} | 📈 CTR: ${fmtPercent(conta.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoConta(conta: MetricasConta, idx: number, objetivo: ObjetivoCliente): string {
  switch (objetivo) {
    case 'compras': return blocoContaCompras(conta, idx)
    case 'leads':
    case 'leads_formulario': return blocoContaLeads(conta, idx)
    case 'whatsapp': return blocoContaWhatsapp(conta, idx)
    case 'engajamento': return blocoContaEngajamento(conta, idx)
    case 'trafego': return blocoContaTrafego(conta, idx)
  }
}

// --- Bloco consolidado ---

function blocoConsolidadoCompras(c: MetricasConta, contas: MetricasConta[]): string {
  const lines: string[] = []
  lines.push(`📌 Resumo Consolidado Geral`)
  lines.push(`💸 Investimento total: ${fmtMoeda(c.spend)}`)
  if (contas.length > 1) {
    const detalhes = contas.map((ct, i) => `C${i + 1}: ${fmtMoeda(ct.spend)}`).join(' | ')
    lines.push(`↳ ${detalhes}`)
  }
  lines.push(`🛍 Compras totais: ${fmtNumero(c.compras)}`)
  lines.push(`💵 Valor total em vendas: ${fmtMoeda(c.receita)}`)
  if (c.roas) lines.push(`📈 ROAS consolidado: ${fmtRoas(c.roas)}`)
  if (c.cpv) lines.push(`💵 CPV médio: ${fmtMoeda(c.cpv)}`)
  if (c.ticketMedio) lines.push(`🎫 Ticket médio: ${fmtMoeda(c.ticketMedio)}`)
  lines.push(`🛒 Add to Cart: ${fmtNumero(c.addToCart)} | 💳 Checkout: ${fmtNumero(c.checkout)}`)
  if (c.taxaCheckoutCompra) lines.push(`📊 Taxa checkout → compra: ${fmtPercent(c.taxaCheckoutCompra)}`)
  lines.push(`👥 Alcance total: ${fmtNumero(c.reach)} | 👁 Impressões: ${fmtNumero(c.impressions)}`)
  return lines.join('\n')
}

function blocoConsolidadoLeads(c: MetricasConta, contas: MetricasConta[]): string {
  const lines: string[] = []
  lines.push(`📌 Resumo Consolidado Geral`)
  lines.push(`💸 Investimento total: ${fmtMoeda(c.spend)}`)
  if (contas.length > 1) {
    const detalhes = contas.map((ct, i) => `C${i + 1}: ${fmtMoeda(ct.spend)}`).join(' | ')
    lines.push(`↳ ${detalhes}`)
  }
  lines.push(`📋 Leads totais: ${fmtNumero(c.leads)}`)
  if (c.cpl) lines.push(`💰 CPL médio: ${fmtMoeda(c.cpl)}`)
  lines.push(`🖱 Cliques totais: ${fmtNumero(c.clicks)} | 📄 Páginas: ${fmtNumero(c.landingPageView)}`)
  lines.push(`👥 Alcance total: ${fmtNumero(c.reach)} | 👁 Impressões: ${fmtNumero(c.impressions)}`)
  if (c.cpm) lines.push(`📊 CPM: ${fmtMoeda(c.cpm)} | 📈 CTR: ${fmtPercent(c.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoConsolidadoWhatsapp(c: MetricasConta, contas: MetricasConta[]): string {
  const lines: string[] = []
  lines.push(`📌 Resumo Consolidado Geral`)
  lines.push(`💸 Investimento total: ${fmtMoeda(c.spend)}`)
  if (contas.length > 1) {
    const detalhes = contas.map((ct, i) => `C${i + 1}: ${fmtMoeda(ct.spend)}`).join(' | ')
    lines.push(`↳ ${detalhes}`)
  }
  lines.push(`💬 Conversas totais: ${fmtNumero(c.conversas)}`)
  if (c.cpConv) lines.push(`💰 Custo por conversa: ${fmtMoeda(c.cpConv)}`)
  lines.push(`🖱 Cliques totais: ${fmtNumero(c.clicks)} | 📄 Páginas: ${fmtNumero(c.landingPageView)}`)
  lines.push(`👥 Alcance total: ${fmtNumero(c.reach)} | 👁 Impressões: ${fmtNumero(c.impressions)}`)
  if (c.cpm) lines.push(`📊 CPM: ${fmtMoeda(c.cpm)} | 📈 CTR: ${fmtPercent(c.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoConsolidadoEngajamento(c: MetricasConta, contas: MetricasConta[]): string {
  const lines: string[] = []
  lines.push(`📌 Resumo Consolidado Geral`)
  lines.push(`💸 Investimento total: ${fmtMoeda(c.spend)}`)
  if (contas.length > 1) {
    const detalhes = contas.map((ct, i) => `C${i + 1}: ${fmtMoeda(ct.spend)}`).join(' | ')
    lines.push(`↳ ${detalhes}`)
  }
  lines.push(`❤️ Engajamento total: ${fmtNumero(c.engajamento)}`)
  if (c.engajamento > 0) lines.push(`💰 Custo por engajamento: ${fmtMoeda(c.spend / c.engajamento)}`)
  lines.push(`👥 Alcance total: ${fmtNumero(c.reach)} | 👁 Impressões: ${fmtNumero(c.impressions)}`)
  if (c.cpm) lines.push(`📊 CPM: ${fmtMoeda(c.cpm)} | 📈 CTR: ${fmtPercent(c.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoConsolidadoTrafego(c: MetricasConta, contas: MetricasConta[]): string {
  const lines: string[] = []
  lines.push(`📌 Resumo Consolidado Geral`)
  lines.push(`💸 Investimento total: ${fmtMoeda(c.spend)}`)
  if (contas.length > 1) {
    const detalhes = contas.map((ct, i) => `C${i + 1}: ${fmtMoeda(ct.spend)}`).join(' | ')
    lines.push(`↳ ${detalhes}`)
  }
  lines.push(`📄 Visitas à página totais: ${fmtNumero(c.landingPageView)}`)
  if (c.landingPageView > 0) lines.push(`💰 Custo por visita: ${fmtMoeda(c.spend / c.landingPageView)}`)
  lines.push(`🖱 Cliques totais: ${fmtNumero(c.clicks)}`)
  lines.push(`👥 Alcance total: ${fmtNumero(c.reach)} | 👁 Impressões: ${fmtNumero(c.impressions)}`)
  if (c.cpm) lines.push(`📊 CPM: ${fmtMoeda(c.cpm)} | 📈 CTR: ${fmtPercent(c.ctr ?? 0)}`)
  return lines.join('\n')
}

function blocoConsolidado(c: MetricasConta, contas: MetricasConta[], objetivo: ObjetivoCliente): string {
  switch (objetivo) {
    case 'compras': return blocoConsolidadoCompras(c, contas)
    case 'leads':
    case 'leads_formulario': return blocoConsolidadoLeads(c, contas)
    case 'whatsapp': return blocoConsolidadoWhatsapp(c, contas)
    case 'engajamento': return blocoConsolidadoEngajamento(c, contas)
    case 'trafego': return blocoConsolidadoTrafego(c, contas)
  }
}

// --- Montagem final ---

export function formatarRelatorioWhatsapp(input: TemplateInput): string {
  const { clienteNome, objetivo, periodoInicio, periodoFim, contas, consolidado, totalCampanhas } = input

  const sections: string[] = []

  // Header
  sections.push(
    `📊 Relatório Semanal – ${clienteNome}\n` +
    `📅 Período: ${fmtData(periodoInicio)} a ${fmtData(periodoFim)}\n` +
    `🚀 Agência: JSR Tráfego\n` +
    `🎯 Objetivo: ${labelObjetivo(objetivo)}\n` +
    `📌 ${contas.length} conta${contas.length > 1 ? 's' : ''} | ${totalCampanhas} campanhas\n` +
    `Bom dia! Segue o resumo da semana 👇`
  )

  // Blocos por conta (se mais de 1 conta, mostrar separado)
  if (contas.length > 1) {
    for (let i = 0; i < contas.length; i++) {
      sections.push(blocoConta(contas[i], i, objetivo))
    }
  }

  // Consolidado (sempre mostra)
  if (contas.length === 1) {
    // Se só tem 1 conta, mostra direto sem "Conta 1" separado
    sections.push(blocoConta(contas[0], 0, objetivo))
  } else {
    sections.push(blocoConsolidado(consolidado, contas, objetivo))
  }

  return sections.join('\n\n')
}
