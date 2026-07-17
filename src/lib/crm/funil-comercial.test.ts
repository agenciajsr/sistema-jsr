import { describe, expect, it } from 'vitest'

import {
  calcularPeriodo,
  montarDashboard,
  taxaConversao,
  variacaoPercentual,
  type InsumosDashboard,
} from './funil-comercial'

describe('calcularPeriodo', () => {
  it('este-mes: do dia 1 até hoje, anterior = mesmo intervalo do mês passado', () => {
    const p = calcularPeriodo('este-mes', '2026-07-17')
    expect(p).toEqual({
      inicio: '2026-07-01',
      fim: '2026-07-17',
      inicioAnterior: '2026-06-01',
      fimAnterior: '2026-06-17',
    })
  })

  it('este-mes na virada: 31 jan → anterior termina em 31 dez', () => {
    const p = calcularPeriodo('este-mes', '2026-01-31')
    expect(p).toEqual({
      inicio: '2026-01-01',
      fim: '2026-01-31',
      inicioAnterior: '2025-12-01',
      fimAnterior: '2025-12-31',
    })
  })

  it('este-mes: dia 31 em mês anterior mais curto trava no último dia', () => {
    const p = calcularPeriodo('este-mes', '2026-03-31')
    expect(p.inicioAnterior).toBe('2026-02-01')
    expect(p.fimAnterior).toBe('2026-02-28')
  })

  it('mes-passado: mês cheio anterior, anterior = mês retrasado cheio', () => {
    const p = calcularPeriodo('mes-passado', '2026-07-17')
    expect(p).toEqual({
      inicio: '2026-06-01',
      fim: '2026-06-30',
      inicioAnterior: '2026-05-01',
      fimAnterior: '2026-05-31',
    })
  })

  it('ultimos-30: 30 dias inclusive terminando hoje, anterior = os 30 antes', () => {
    const p = calcularPeriodo('ultimos-30', '2026-07-17')
    expect(p).toEqual({
      inicio: '2026-06-18',
      fim: '2026-07-17',
      inicioAnterior: '2026-05-19',
      fimAnterior: '2026-06-17',
    })
  })

  it('este-ano: 1 jan até hoje, anterior = ano passado até a mesma data', () => {
    const p = calcularPeriodo('este-ano', '2026-07-17')
    expect(p).toEqual({
      inicio: '2026-01-01',
      fim: '2026-07-17',
      inicioAnterior: '2025-01-01',
      fimAnterior: '2025-07-17',
    })
  })
})

describe('variacaoPercentual', () => {
  it('crescimento', () => expect(variacaoPercentual(150, 100)).toBe(50))
  it('queda', () => expect(variacaoPercentual(50, 100)).toBe(-50))
  it('-100% quando zera', () => expect(variacaoPercentual(0, 4)).toBe(-100))
  it('base zero → null (UI mostra —)', () => expect(variacaoPercentual(5, 0)).toBeNull())
})

describe('taxaConversao', () => {
  it('denominador zero → 0', () => expect(taxaConversao(3, 0)).toBe(0))
  it('normal', () => expect(taxaConversao(1, 4)).toBe(25))
})

const INSUMOS_CHEIOS: InsumosDashboard = {
  atual: { criadas: 10, agendadas: 5, ganhas: 2, receita: 3000, perdidas: 3 },
  anterior: { criadas: 8, agendadas: 4, ganhas: 1, receita: 1000, perdidas: 6 },
  origens: [
    { origem: 'whatsapp', total: 6 },
    { origem: null, total: 4 },
  ],
}

describe('montarDashboard', () => {
  it('caso cheio: KPIs com variação, funil, performance e origens', () => {
    const d = montarDashboard(INSUMOS_CHEIOS)
    expect(d.kpis.novosLeads).toEqual({ valor: 10, variacao: 25 })
    expect(d.kpis.agendados).toEqual({ valor: 5, variacao: 25 })
    expect(d.kpis.vendas).toEqual({ valor: 2, variacao: 100 })
    expect(d.kpis.receitaTotal).toEqual({ valor: 3000, variacao: 200 })
    expect(d.kpis.leadsPerdidos).toEqual({ valor: 3, variacao: -50 })
    expect(d.funil).toEqual({
      novoLead: 10,
      agendado: 5,
      pagou: 2,
      taxaNovoAgendado: 50,
      taxaAgendadoPagou: 40,
    })
    expect(d.performance.conversaoTotal.valor).toBe(20)
    expect(d.performance.ticketMedio.valor).toBe(1500)
    expect(d.performance.receitaPorLead.valor).toBe(300)
    // origem null cai em 'outro' (mesmo fallback de dados.ts)
    expect(d.origens).toEqual([
      { origem: 'whatsapp', total: 6, pct: 60 },
      { origem: 'outro', total: 4, pct: 40 },
    ])
  })

  it('tudo-zero: nenhum NaN/Infinity — divisões viram 0, variações viram null', () => {
    const d = montarDashboard({
      atual: { criadas: 0, agendadas: 0, ganhas: 0, receita: 0, perdidas: 0 },
      anterior: { criadas: 0, agendadas: 0, ganhas: 0, receita: 0, perdidas: 0 },
      origens: [],
    })
    expect(d.kpis.novosLeads).toEqual({ valor: 0, variacao: null })
    expect(d.funil.taxaNovoAgendado).toBe(0)
    expect(d.funil.taxaAgendadoPagou).toBe(0)
    expect(d.performance.conversaoTotal.valor).toBe(0)
    expect(d.performance.ticketMedio.valor).toBe(0)
    expect(d.performance.receitaPorLead.valor).toBe(0)
    expect(d.origens).toEqual([])
    for (const v of [
      d.performance.conversaoTotal.valor,
      d.performance.ticketMedio.valor,
      d.performance.receitaPorLead.valor,
    ]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('receita é número (nunca string do numeric do banco)', () => {
    const d = montarDashboard(INSUMOS_CHEIOS)
    expect(typeof d.kpis.receitaTotal.valor).toBe('number')
  })
})
