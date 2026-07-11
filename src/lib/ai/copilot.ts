// Copilot conversacional da Agência JSR — persona + snapshot dos dados de
// exemplo + constante do modelo. Módulo SERVER-ONLY (lê process.env e importa
// mocks); NÃO adicionar 'use client'. Consumido apenas pelo Route Handler
// src/app/api/chat/route.ts.
//
// IMPORTANTE: enquanto as integrações reais (Meta/Google Ads + financeiro) não
// entram, o snapshot vem dos mocks. A persona é instruída a deixar isso claro.

import {
  agencyHealthMock,
  alertasMock,
  clientesTrafegoMock,
  financeiroMock,
} from '@/lib/mock/dashboard'
import {
  campanhasSaudeMock,
  kpisMock,
  resumoFinanceiroMock,
} from '@/lib/mock/dashboard-ref'

// Modelo configurável via env (decisão LOCKED). Default gpt-4o-mini se ausente.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// System prompt em pt-BR. Define a persona (analista sênior de tráfego pago da
// JSR) e as regras de comportamento vindas da visão do produto.
export function buildSystemPrompt(): string {
  return [
    'Você é o Copilot da Agência JSR, uma analista sênior de tráfego pago que apoia a equipe interna da agência.',
    'A JSR é uma agência de marketing digital focada em tráfego pago (Meta Ads e Google Ads), que também presta landing pages, CRM, estruturação e estratégia.',
    '',
    'Regras de comportamento (obrigatórias):',
    '1. NUNCA responda apenas repetindo números. SEMPRE traga uma análise do que os dados significam E uma sugestão de ação concreta e prática.',
    '2. Seja objetiva, direta e clara. Responda sempre em português do Brasil.',
    '3. Use SOMENTE os dados fornecidos no SNAPSHOT abaixo. Se faltar um dado para responder, diga exatamente o que falta em vez de inventar números.',
    '4. Os números do snapshot são DADOS DE EXEMPLO (mocks), ainda não conectados às integrações reais de Meta/Google Ads e ao financeiro. Deixe isso claro quando apresentar números, para não passar dados de exemplo como reais.',
    '5. Priorize o que exige atenção: verba prestes a esgotar, contratos a vencer, quedas de performance e clientes em risco.',
    '',
    'Formato: respostas curtas e escaneáveis. Use listas quando ajudar. Evite jargão desnecessário.',
  ].join('\n')
}

// Snapshot compacto e legível da agência a partir dos mocks. Mantido enxuto
// (linhas resumidas, não objetos crus) para economizar tokens.
export function buildSnapshot(): string {
  const linhas: string[] = []

  linhas.push('=== SNAPSHOT DA AGÊNCIA (dados de EXEMPLO) ===')

  // KPIs gerais
  linhas.push('')
  linhas.push('KPIs do mês:')
  for (const kpi of kpisMock) {
    const tend = kpi.tendencia
      ? ` (${kpi.tendencia.direcao === 'up' ? '+' : '-'}${kpi.tendencia.valor}${kpi.helper ? ' ' + kpi.helper : ''})`
      : kpi.helper
        ? ` (${kpi.helper})`
        : ''
    linhas.push(`- ${kpi.label}: ${kpi.valor}${tend}`)
  }

  // Saúde da agência
  linhas.push('')
  linhas.push(
    `Saúde geral da agência: score ${agencyHealthMock.score}/100 | ${agencyHealthMock.clientesAtivos} clientes ativos | ${agencyHealthMock.clientesEmRisco} em risco.`,
  )

  // Saúde das campanhas por cliente
  linhas.push('')
  linhas.push('Saúde das campanhas por cliente:')
  for (const c of campanhasSaudeMock) {
    linhas.push(
      `- ${c.nome}: ${c.campanhasAtivas} campanhas ativas, score ${c.score}/100 (${c.rotulo}).`,
    )
  }

  // Clientes de tráfego (verba)
  linhas.push('')
  linhas.push('Clientes de tráfego (verba do mês):')
  for (const c of clientesTrafegoMock) {
    const pct = Math.round((c.verbaGasta / c.verbaTotal) * 100)
    linhas.push(
      `- ${c.nome} (${c.nicho}): verba R$ ${c.verbaGasta} de R$ ${c.verbaTotal} (${pct}% consumido), ${c.campanhas.length} campanha(s), última sync ${c.ultimaSync}.`,
    )
  }

  // Financeiro por cliente
  linhas.push('')
  linhas.push('Financeiro por cliente (MRR e cobrança):')
  for (const f of financeiroMock) {
    linhas.push(
      `- ${f.cliente}: MRR R$ ${f.mrr}, cobrança dia ${f.diaCobranca}, status ${f.status}.`,
    )
  }

  // Resumo financeiro consolidado
  linhas.push('')
  linhas.push(
    `Resumo financeiro do mês: receitas ${resumoFinanceiroMock.receitas.valor} (${resumoFinanceiroMock.receitas.helper}), despesas ${resumoFinanceiroMock.despesas.valor} (${resumoFinanceiroMock.despesas.helper}), lucro ${resumoFinanceiroMock.lucro.valor} (${resumoFinanceiroMock.lucro.tendencia.direcao === 'up' ? '+' : '-'}${resumoFinanceiroMock.lucro.tendencia.valor} ${resumoFinanceiroMock.lucro.helper}).`,
  )

  // Alertas ativos
  linhas.push('')
  linhas.push('Alertas ativos:')
  for (const a of alertasMock) {
    linhas.push(
      `- [${a.severidade.toUpperCase()}] ${a.titulo} — ${a.cliente}: ${a.detalhe} (${a.quando}).`,
    )
  }

  return linhas.join('\n')
}

// Mensagem de sistema combinada (persona + snapshot), pronta para o streamText.
export function buildSystemMessage(): string {
  return `${buildSystemPrompt()}\n\n${buildSnapshot()}`
}
