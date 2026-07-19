import { describe, it, expect } from 'vitest'

import type { MetricasConta } from './gerar-relatorio'
import {
  calcularPeriodo,
  devidoHoje,
  proximoEnvio,
  compilarBlocos,
  montarTextoRelatorio,
  type BlocoComMetricas,
} from './engine'

function metricas(overrides: Partial<MetricasConta> = {}): MetricasConta {
  return {
    contaId: 'c1',
    contaNome: 'Conta Teste',
    spend: 0, reach: 0, impressions: 0, clicks: 0,
    landingPageView: 0, addToCart: 0, checkout: 0,
    compras: 0, leads: 0, conversas: 0, engajamento: 0, linkClicks: 0,
    videoViews: 0, curtidasPagina: 0, receita: 0,
    roas: null, cpv: null, cpl: null, cpConv: null, ticketMedio: null,
    cpm: null, ctr: null, taxaCheckoutCompra: null,
    ...overrides,
  }
}

// 2026-07-13 é uma segunda-feira.

describe('calcularPeriodo', () => {
  it('semanal com 7 dias na segunda → segunda a domingo anteriores', () => {
    const p = calcularPeriodo({ frequencia: 'semanal', periodoDias: 7 }, '2026-07-13')
    expect(p).toEqual({ inicio: '2026-07-06', fim: '2026-07-12' })
  })

  it('semanal sem periodoDias usa default 7', () => {
    const p = calcularPeriodo({ frequencia: 'semanal', periodoDias: null }, '2026-07-13')
    expect(p).toEqual({ inicio: '2026-07-06', fim: '2026-07-12' })
  })

  it('mensal sem periodoDias → mês anterior completo', () => {
    const p = calcularPeriodo({ frequencia: 'mensal', periodoDias: null }, '2026-07-13')
    expect(p).toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })

  it('mensal em janeiro → dezembro do ano anterior', () => {
    const p = calcularPeriodo({ frequencia: 'mensal', periodoDias: null }, '2026-01-05')
    expect(p).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' })
  })

  it('mensal com periodoDias → últimos N dias completos', () => {
    const p = calcularPeriodo({ frequencia: 'mensal', periodoDias: 30 }, '2026-07-13')
    expect(p).toEqual({ inicio: '2026-06-13', fim: '2026-07-12' })
  })
})

describe('devidoHoje', () => {
  const base = { periodoDias: null, ativo: true }

  it('semanal só no dia da semana configurado (1 = segunda)', () => {
    const cfg = { ...base, frequencia: 'semanal' as const, diaSemana: 1, diaMes: null }
    expect(devidoHoje(cfg, '2026-07-13')).toBe(true) // segunda
    expect(devidoHoje(cfg, '2026-07-14')).toBe(false) // terça
  })

  it('mensal só no dia do mês configurado', () => {
    const cfg = { ...base, frequencia: 'mensal' as const, diaSemana: null, diaMes: 15 }
    expect(devidoHoje(cfg, '2026-07-15')).toBe(true)
    expect(devidoHoje(cfg, '2026-07-16')).toBe(false)
  })

  it('diaMes 31 grampeia para o último dia do mês (fevereiro)', () => {
    const cfg = { ...base, frequencia: 'mensal' as const, diaSemana: null, diaMes: 31 }
    expect(devidoHoje(cfg, '2026-02-28')).toBe(true) // 2026 não é bissexto
    expect(devidoHoje(cfg, '2026-02-27')).toBe(false)
    expect(devidoHoje(cfg, '2028-02-29')).toBe(true) // bissexto
    expect(devidoHoje(cfg, '2026-04-30')).toBe(true) // abril tem 30
  })

  it('config inativa nunca é devida', () => {
    const cfg = { frequencia: 'semanal' as const, diaSemana: 1, diaMes: null, ativo: false }
    expect(devidoHoje(cfg, '2026-07-13')).toBe(false)
  })
})

describe('proximoEnvio', () => {
  it('projeta a próxima data devida', () => {
    const cfg = { frequencia: 'semanal' as const, diaSemana: 1, diaMes: null, ativo: true }
    expect(proximoEnvio(cfg, '2026-07-14')).toBe('2026-07-20') // próxima segunda
    expect(proximoEnvio(cfg, '2026-07-13')).toBe('2026-07-13') // hoje mesmo
  })

  it('mensal aponta para o dia do próximo mês quando já passou', () => {
    const cfg = { frequencia: 'mensal' as const, diaSemana: null, diaMes: 1, ativo: true }
    expect(proximoEnvio(cfg, '2026-07-13')).toBe('2026-08-01')
  })

  it('inativa → null', () => {
    const cfg = { frequencia: 'semanal' as const, diaSemana: 1, diaMes: null, ativo: false }
    expect(proximoEnvio(cfg, '2026-07-13')).toBeNull()
  })
})

describe('compilarBlocos', () => {
  it('soma brutas e recalcula derivadas', () => {
    const a = metricas({ spend: 100, leads: 10, receita: 0, impressions: 1000, clicks: 50 })
    const b = metricas({ spend: 300, compras: 6, receita: 1200, impressions: 3000, clicks: 30 })
    const c = compilarBlocos([a, b])
    expect(c.spend).toBe(400)
    expect(c.leads).toBe(10)
    expect(c.compras).toBe(6)
    expect(c.receita).toBe(1200)
    expect(c.roas).toBe(3) // 1200/400
    expect(c.cpl).toBe(40) // 400/10
    expect(c.cpv).toBeCloseTo(400 / 6)
    expect(c.cpm).toBe(100) // 400/4000*1000
    expect(c.ctr).toBe(2) // 80/4000*100
  })

  it('sem dados → derivadas null', () => {
    const c = compilarBlocos([metricas()])
    expect(c.roas).toBeNull()
    expect(c.cpl).toBeNull()
  })
})

describe('montarTextoRelatorio', () => {
  it('caso 2 blocos + compilado (cliente com conta de leads e conta de vendas)', () => {
    const config = {
      cabecalho: '📊 Relatório – {{cliente}}\n📅 {{date_range}}',
      incluirCompilado: true,
      mensagemCompilado: '📌 Compilado: {{investimento}} investidos | ROAS {{roas}}',
    }
    const blocos: BlocoComMetricas[] = [
      {
        bloco: { ordem: 0, mensagem: '🏦 {{conta}}\n📋 Leads: {{leads}} | CPL: {{cpl}}', metricas: ['leads', 'cpl'] },
        metricas: metricas({ contaNome: 'Conta Leads', spend: 100, leads: 10, cpl: 10 }),
      },
      {
        bloco: { ordem: 1, mensagem: '🏦 {{conta}}\n🛍 Compras: {{compras}} | Receita: {{receita}}', metricas: ['compras', 'receita'] },
        metricas: metricas({ contaNome: 'Conta Vendas', spend: 300, compras: 6, receita: 1200, roas: 4 }),
      },
    ]

    const texto = montarTextoRelatorio(config, blocos, { inicio: '2026-07-06', fim: '2026-07-12' }, 'Loja X')

    expect(texto).toBe(
      '📊 Relatório – Loja X\n📅 06/07 a 12/07\n\n' +
      '🏦 Conta Leads\n📋 Leads: 10 | CPL: R$ 10,00\n\n' +
      '🏦 Conta Vendas\n🛍 Compras: 6 | Receita: R$ 1.200,00\n\n' +
      '📌 Compilado: R$ 400,00 investidos | ROAS 3,00x',
    )
  })

  it('bloco único: compilado não é repetido', () => {
    const config = { cabecalho: 'Rel {{cliente}}', incluirCompilado: true, mensagemCompilado: null }
    const blocos: BlocoComMetricas[] = [
      { bloco: { ordem: 0, mensagem: 'Invest: {{investimento}}', metricas: [] }, metricas: metricas({ spend: 50 }) },
    ]
    const texto = montarTextoRelatorio(config, blocos, { inicio: '2026-07-06', fim: '2026-07-12' }, 'Y')
    expect(texto).toBe('Rel Y\n\nInvest: R$ 50,00')
  })

  it('respeita a ordem dos blocos mesmo fora de ordem no array', () => {
    const config = { cabecalho: 'H', incluirCompilado: false, mensagemCompilado: null }
    const blocos: BlocoComMetricas[] = [
      { bloco: { ordem: 1, mensagem: 'B', metricas: [] }, metricas: metricas() },
      { bloco: { ordem: 0, mensagem: 'A', metricas: [] }, metricas: metricas() },
    ]
    const texto = montarTextoRelatorio(config, blocos, { inicio: '2026-07-06', fim: '2026-07-12' }, 'Y')
    expect(texto).toBe('H\n\nA\n\nB')
  })
})
