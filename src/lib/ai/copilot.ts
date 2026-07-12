// Copilot conversacional da Agência JSR — persona + snapshot dos DADOS REAIS da
// agência + constante do modelo. Módulo SERVER-ONLY (lê process.env e chama
// Server Actions / queries do banco); NÃO adicionar 'use client'. Consumido
// apenas pelos Route Handlers nodejs src/app/api/chat/route.ts e
// src/app/api/insights/route.ts.
//
// IMPORTANTE: o snapshot agora vem de DADOS REAIS (financeiro consolidado,
// clientes/contratos, alertas ativos e performance de campanhas por cliente).
// A performance reflete a ÚLTIMA SINCRONIZAÇÃO da Meta, não tempo real — a
// persona é instruída a deixar isso claro. Cada seção é isolada em try/catch:
// se uma fonte falhar/vier vazia, o snapshot degrada para uma linha neutra e o
// chat NUNCA quebra.

import { format, differenceInCalendarDays, parseISO } from 'date-fns'

import { db } from '@/lib/db'
import {
  calcularMrr,
  getResumoFinanceiro,
  listTransacoes,
} from '@/actions/financeiro'
import { getAlertas } from '@/actions/alertas'
import { getUltimaSync } from '@/actions/trafego'
import { getContratosDoCliente } from '@/actions/contratos'
import {
  listarClientesComContas,
  getResumoCliente,
} from '@/lib/trafego/aggregate'

// Modelo configurável via env (decisão LOCKED). Default gpt-4o-mini se ausente.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// Formata um número como moeda brasileira (R$) de forma tolerante a nulos.
function brl(valor: number | null | undefined): string {
  const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Rótulo amigável do nicho em pt-BR.
function rotuloNicho(nicho: string): string {
  switch (nicho) {
    case 'ecommerce':
      return 'e-commerce'
    case 'negocio_local':
      return 'negócio local'
    case 'infoproduto':
      return 'infoproduto'
    default:
      return nicho
  }
}

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
    '4. Os números do snapshot são DADOS REAIS do sistema JSR (financeiro, clientes, contratos, alertas e campanhas). A performance de campanhas reflete a ÚLTIMA SINCRONIZAÇÃO da Meta indicada no cabeçalho do snapshot, NÃO é tempo real — cite a data dessa última sincronização quando apresentar números de campanha, para deixar claro que os valores podem ter mudado desde então. É PROIBIDO inventar ou estimar números que não estejam no snapshot: use apenas o que está ali e, se algo estiver faltando, diga o que falta.',
    '5. Priorize o que exige atenção: verba prestes a esgotar, contratos a vencer, quedas de performance e clientes em risco.',
    '',
    'Formato: respostas curtas e escaneáveis. Use listas quando ajudar. Evite jargão desnecessário.',
  ].join('\n')
}

// Snapshot compacto e legível da agência a partir dos DADOS REAIS. Mantido
// enxuto (linhas resumidas, não objetos crus) para economizar tokens (~10
// clientes). Cada seção tem seu PRÓPRIO try/catch: falha/vazio vira linha
// neutra e o snapshot segue — NUNCA lança.
export async function buildSnapshot(): Promise<string> {
  const linhas: string[] = []

  // --- CABEÇALHO: agora + última sync da Meta ---
  try {
    const agora = format(new Date(), 'dd/MM/yyyy HH:mm')
    let ultimaSyncTxt = 'nunca'
    try {
      const ultimaSync = await getUltimaSync()
      if (ultimaSync) {
        ultimaSyncTxt = format(ultimaSync, 'dd/MM/yyyy HH:mm')
      }
    } catch {
      ultimaSyncTxt = 'indisponível'
    }
    linhas.push('=== SNAPSHOT DA AGÊNCIA (dados reais) ===')
    linhas.push(
      `Gerado em ${agora} | Última sincronização da Meta: ${ultimaSyncTxt}`,
    )
  } catch {
    linhas.push('=== SNAPSHOT DA AGÊNCIA (dados reais) ===')
  }

  // --- FINANCEIRO CONSOLIDADO ---
  linhas.push('')
  linhas.push('FINANCEIRO CONSOLIDADO:')
  try {
    const [mrr, resumo, transacoes] = await Promise.all([
      calcularMrr(),
      getResumoFinanceiro(),
      listTransacoes(),
    ])

    let aReceber = 0
    let inadimplencia = 0
    for (const t of transacoes) {
      if (t.tipo !== 'receita') continue
      const valor = parseFloat(t.valor) || 0
      if (t.status === 'pendente') aReceber += valor
      else if (t.status === 'vencido') inadimplencia += valor
    }

    linhas.push(`- MRR total (contratos ativos): ${brl(mrr)}.`)
    linhas.push(
      `- Mês atual: receita ${brl(resumo.receita)}, despesa ${brl(resumo.despesa)}, lucro ${brl(resumo.lucro)}.`,
    )
    linhas.push(
      `- A receber (receitas pendentes): ${brl(aReceber)} | Inadimplência (receitas vencidas): ${brl(inadimplencia)}.`,
    )
  } catch {
    linhas.push('- (financeiro indisponível no momento)')
  }

  // --- CLIENTES (com contrato atual e flag de risco) ---
  linhas.push('')
  linhas.push('CLIENTES:')
  try {
    const clientesRows = await db.query.clientes.findMany({
      columns: { id: true, nome: true, nicho: true, status: true },
    })

    if (clientesRows.length === 0) {
      linhas.push('- Ainda não há clientes cadastrados.')
    } else {
      const hoje = new Date()
      const linhasClientes = await Promise.all(
        clientesRows.map(async (c) => {
          let mrrTxt = 'sem contrato ativo'
          let risco = false
          let motivoRisco = ''

          if (c.status === 'pausado' || c.status === 'encerrado') {
            risco = true
            motivoRisco = c.status
          }

          try {
            const { contratoAtual } = await getContratosDoCliente(c.id)
            if (contratoAtual) {
              const valorMensal = parseFloat(contratoAtual.valorMensal) || 0
              mrrTxt = `MRR ${brl(valorMensal)}`
              const diasParaVencer = differenceInCalendarDays(
                parseISO(contratoAtual.dataVencimento),
                hoje,
              )
              if (diasParaVencer < 0) {
                risco = true
                motivoRisco = motivoRisco
                  ? `${motivoRisco}, contrato vencido`
                  : 'contrato vencido'
              } else if (diasParaVencer <= 30) {
                risco = true
                const complemento = `contrato vence em ${diasParaVencer} dia(s)`
                motivoRisco = motivoRisco
                  ? `${motivoRisco}, ${complemento}`
                  : complemento
              }
            }
          } catch {
            mrrTxt = 'contrato indisponível'
          }

          const flag = risco ? ` — EM RISCO (${motivoRisco})` : ''
          return `- ${c.nome} (${rotuloNicho(c.nicho)}, ${c.status}): ${mrrTxt}${flag}.`
        }),
      )
      linhas.push(...linhasClientes)
    }
  } catch {
    linhas.push('- (lista de clientes indisponível no momento)')
  }

  // --- ALERTAS ATIVOS ---
  linhas.push('')
  linhas.push('ALERTAS ATIVOS:')
  try {
    const alertas = await getAlertas()
    if (alertas.length === 0) {
      linhas.push('- Nenhum alerta ativo.')
    } else {
      for (const a of alertas) {
        linhas.push(
          `- [${a.severidade.toUpperCase()}] ${a.titulo} — ${a.clienteNome}: ${a.detalhe}`,
        )
      }
    }
  } catch {
    linhas.push('- (alertas indisponíveis no momento)')
  }

  // --- PERFORMANCE DE CAMPANHAS (por cliente com contas Meta vinculadas) ---
  linhas.push('')
  linhas.push(
    'PERFORMANCE DE CAMPANHAS (últimos 30 dias, por cliente com contas Meta):',
  )
  try {
    const clientesComContas = await listarClientesComContas()
    if (clientesComContas.length === 0) {
      linhas.push('- Nenhum cliente com contas Meta vinculadas ainda.')
    } else {
      const linhasPerf = await Promise.all(
        clientesComContas.map(async (c) => {
          try {
            const resumo = await getResumoCliente(c.id, 30)
            if (!resumo || !resumo.temDados) {
              return `- ${c.nome} (${rotuloNicho(c.nicho)}): sem dados de campanha ainda.`
            }
            const { totais, heroi, derivadas } = resumo
            const valorHeroi =
              heroi.chave === 'vendas'
                ? totais.vendas
                : heroi.chave === 'conversas'
                  ? totais.conversas
                  : totais.leads
            const partes = [
              `verba ${brl(totais.spend)}`,
              `${heroi.label} ${valorHeroi}`,
              `leads ${totais.leads}`,
              `vendas ${totais.vendas}`,
              `conversas ${totais.conversas}`,
            ]
            if (derivadas.custoPorResultadoHeroi != null) {
              partes.push(
                `custo por ${heroi.label.toLowerCase()} ${brl(derivadas.custoPorResultadoHeroi)}`,
              )
            }
            return `- ${c.nome} (${rotuloNicho(c.nicho)}): ${partes.join(', ')}.`
          } catch {
            return `- ${c.nome} (${rotuloNicho(c.nicho)}): dados de campanha indisponíveis.`
          }
        }),
      )
      linhas.push(...linhasPerf)
    }
  } catch {
    linhas.push('- (performance de campanhas indisponível no momento)')
  }

  return linhas.join('\n')
}

// Mensagem de sistema combinada (persona + snapshot real), pronta para o
// streamText. Async porque o snapshot agora consulta fontes reais.
export async function buildSystemMessage(): Promise<string> {
  const snapshot = await buildSnapshot()
  return `${buildSystemPrompt()}\n\n${snapshot}`
}
