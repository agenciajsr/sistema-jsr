/**
 * Galeria de templates prontos para relatórios configuráveis.
 * Textos pt-BR com variáveis do catálogo (variaveis.ts).
 * O legado templates-whatsapp.ts permanece intocado (fluxo manual).
 */

export type TemplateGaleria = {
  id: string
  nome: string
  descricao: string
  cabecalho: string
  mensagemBloco: string
  metricasSugeridas: string[]
}

export const TEMPLATES_GALERIA: TemplateGaleria[] = [
  {
    id: 'foco-conversas',
    nome: 'Foco em Conversas',
    descricao: 'Para clientes de negócio local: conversas no WhatsApp e custo por conversa.',
    cabecalho:
      '📊 Relatório – {{cliente}}\n' +
      '📅 Período: {{date_range}}\n' +
      '🚀 Agência: JSR Tráfego\n' +
      'Bom dia! Segue o resumo do período 👇',
    mensagemBloco:
      '🏦 {{conta}}\n' +
      '💸 Investimento: {{investimento}}\n' +
      '👥 Alcance: {{alcance}}\n' +
      '🖱 Cliques: {{cliques}}\n' +
      '💬 Conversas iniciadas: {{conversas}}\n' +
      '💰 Custo por conversa: {{custo_por_conversa}}',
    metricasSugeridas: ['investimento', 'alcance', 'cliques', 'conversas', 'custo_por_conversa'],
  },
  {
    id: 'resumo-executivo',
    nome: 'Resumo Executivo',
    descricao: 'Visão enxuta: investimento, resultado principal e retorno — direto ao ponto.',
    cabecalho:
      '📊 Resumo Executivo – {{cliente}}\n' +
      '📅 {{date_range}}\n' +
      '🚀 JSR Tráfego',
    mensagemBloco:
      '🏦 {{conta}}\n' +
      '💸 Investimento: {{investimento}}\n' +
      '📋 Leads: {{leads}} | 💬 Conversas: {{conversas}}\n' +
      '🛍 Compras: {{compras}} | 💵 Receita: {{receita}}\n' +
      '📈 ROAS: {{roas}}',
    metricasSugeridas: ['investimento', 'leads', 'conversas', 'compras', 'receita', 'roas'],
  },
  {
    id: 'foco-performance',
    nome: 'Foco em Performance',
    descricao: 'Métricas completas de mídia: alcance, impressões, CTR, CPM e conversões.',
    cabecalho:
      '📊 Relatório de Performance – {{cliente}}\n' +
      '📅 Período: {{date_range}}\n' +
      '🚀 Agência: JSR Tráfego\n' +
      'Segue a análise completa do período 👇',
    mensagemBloco:
      '🏦 {{conta}}\n' +
      '💸 Investimento: {{investimento}}\n' +
      '👥 Alcance: {{alcance}} | 👁 Impressões: {{impressoes}}\n' +
      '🖱 Cliques: {{cliques}} | 📈 CTR: {{ctr}}\n' +
      '📊 CPM: {{cpm}} | 💰 CPC: {{cpc}}\n' +
      '📄 Visitas à página: {{visitas_pagina}}\n' +
      '🛍 Compras: {{compras}} | 💵 Receita: {{receita}}\n' +
      '📈 ROAS: {{roas}}',
    metricasSugeridas: [
      'investimento', 'alcance', 'impressoes', 'cliques', 'ctr', 'cpm', 'cpc',
      'visitas_pagina', 'compras', 'receita', 'roas',
    ],
  },
]
