import { describe, it, expect } from 'vitest'

import type { Heroi, MetricasIntervalo } from '@/lib/trafego/aggregate'
import type { Alerta, SeveridadeAlerta, TipoAlerta } from '@/lib/alertas/types'
import {
  avaliarSaudeCliente,
  calcularHealthScore,
  type EntradaSaude,
} from '@/lib/saude/avaliar-campanhas'

const HEROI_VENDAS: Heroi = { chave: 'vendas', label: 'Vendas' }
const HEROI_LEADS: Heroi = { chave: 'leads', label: 'Leads' }

function mkMetricas(
  over: Partial<MetricasIntervalo> = {},
  heroi: Heroi = HEROI_VENDAS,
): MetricasIntervalo {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: null,
    leads: 0,
    vendas: 0,
    conversas: 0,
    resultadoHeroi: 0,
    cpa: null,
    cpl: null,
    custoPorResultadoHeroi: null,
    heroi,
    ...over,
  }
}

function mkEntrada(
  atual: MetricasIntervalo,
  anterior: MetricasIntervalo,
  metas: { metaCpa?: number | null; metaCpl?: number | null } = {},
): EntradaSaude {
  return {
    clienteId: 'c1',
    clienteNome: 'Cliente Teste',
    metaCpa: metas.metaCpa ?? null,
    metaCpl: metas.metaCpl ?? null,
    atual,
    anterior,
  }
}

function tipos(alertas: Alerta[]): TipoAlerta[] {
  return alertas.map((a) => a.tipo)
}

function mkAlerta(
  tipo: TipoAlerta,
  severidade: SeveridadeAlerta,
  clienteId = 'c1',
): Alerta {
  return {
    id: `${tipo}-${clienteId}`,
    tipo,
    severidade,
    titulo: 't',
    detalhe: 'd',
    clienteNome: 'Cliente Teste',
    clienteId,
    dataRelevante: '2026-07-12',
  }
}

describe('avaliarSaudeCliente — CPA/CPL com meta', () => {
  it('gera cpa_alto (atenção) quando CPA excede a meta sem chegar ao fator crítico', () => {
    const atual = mkMetricas({ spend: 300, vendas: 12, resultadoHeroi: 12, cpa: 25 })
    const anterior = mkMetricas({ spend: 300, vendas: 12, resultadoHeroi: 12, cpa: 25 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpa: 20 }))
    const cpa = alertas.find((a) => a.tipo === 'cpa_alto')
    expect(cpa).toBeDefined()
    expect(cpa?.severidade).toBe('atencao')
  })

  it('gera cpa_alto CRÍTICO quando CPA >= META_FATOR_CRITICO x meta', () => {
    const atual = mkMetricas({ spend: 400, vendas: 10, resultadoHeroi: 10, cpa: 40 })
    const anterior = mkMetricas({ spend: 400, vendas: 10, resultadoHeroi: 10, cpa: 40 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpa: 20 }))
    const cpa = alertas.find((a) => a.tipo === 'cpa_alto')
    expect(cpa?.severidade).toBe('critico')
  })

  it('usa CPL/metaCpl quando o herói é leads', () => {
    const atual = mkMetricas({ spend: 200, leads: 10, resultadoHeroi: 10, cpl: 20 }, HEROI_LEADS)
    const anterior = mkMetricas({ spend: 200, leads: 10, resultadoHeroi: 10, cpl: 20 }, HEROI_LEADS)
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpl: 10 }))
    const cpa = alertas.find((a) => a.tipo === 'cpa_alto')
    expect(cpa).toBeDefined()
    expect(cpa?.severidade).toBe('critico') // 20 >= 10 * 1.5
  })

  it('não gera cpa_alto quando o CPA está dentro da meta', () => {
    const atual = mkMetricas({ spend: 200, vendas: 20, resultadoHeroi: 20, cpa: 10 })
    const anterior = mkMetricas({ spend: 200, vendas: 20, resultadoHeroi: 20, cpa: 10 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpa: 20 }))
    expect(tipos(alertas)).not.toContain('cpa_alto')
  })
})

describe('avaliarSaudeCliente — CPA sem meta (baseline automático)', () => {
  it('gera cpa_alto quando o CPA sobe >= 35% vs. período anterior', () => {
    const atual = mkMetricas({ spend: 150, vendas: 10, resultadoHeroi: 10, cpa: 15 })
    const anterior = mkMetricas({ spend: 100, vendas: 10, resultadoHeroi: 10, cpa: 10 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    const cpa = alertas.find((a) => a.tipo === 'cpa_alto')
    expect(cpa).toBeDefined()
    expect(cpa?.severidade).toBe('atencao')
  })

  it('NÃO gera cpa_alto quando o CPA sobe menos de 35%', () => {
    const atual = mkMetricas({ spend: 110, vendas: 10, resultadoHeroi: 10, cpa: 11 })
    const anterior = mkMetricas({ spend: 100, vendas: 10, resultadoHeroi: 10, cpa: 10 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    expect(tipos(alertas)).not.toContain('cpa_alto')
  })
})

describe('avaliarSaudeCliente — queda de resultado-herói', () => {
  it('gera performance_caindo com queda >= 30% e volume anterior suficiente', () => {
    const atual = mkMetricas({ spend: 200, vendas: 5, resultadoHeroi: 5 })
    const anterior = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    expect(tipos(alertas)).toContain('performance_caindo')
  })

  it('NÃO gera performance_caindo se o volume anterior for insuficiente', () => {
    // spend 60: acima do minimo de avaliacao (50) mas abaixo do de sem_conversao (100)
    const atual = mkMetricas({ spend: 60, vendas: 0, resultadoHeroi: 0 })
    const anterior = mkMetricas({ spend: 60, vendas: 3, resultadoHeroi: 3 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    expect(tipos(alertas)).not.toContain('performance_caindo')
  })
})

describe('avaliarSaudeCliente — queda de CTR', () => {
  it('gera ctr_caindo com queda de CTR >= 30%', () => {
    const atual = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20, ctr: 1.0 })
    const anterior = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20, ctr: 2.0 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    expect(tipos(alertas)).toContain('ctr_caindo')
  })
})

describe('avaliarSaudeCliente — gastando sem converter', () => {
  it('gera sem_conversao (crítico) com gasto relevante e zero resultado-herói', () => {
    const atual = mkMetricas({ spend: 150, vendas: 0, resultadoHeroi: 0 })
    const anterior = mkMetricas({ spend: 150, vendas: 0, resultadoHeroi: 0 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    const sc = alertas.find((a) => a.tipo === 'sem_conversao')
    expect(sc).toBeDefined()
    expect(sc?.severidade).toBe('critico')
  })
})

describe('avaliarSaudeCliente — volume mínimo geral', () => {
  it('NÃO gera sinais comparativos quando spend atual está abaixo do mínimo', () => {
    const atual = mkMetricas({ spend: 30, vendas: 1, resultadoHeroi: 1, cpa: 30, ctr: 0.5 })
    const anterior = mkMetricas({ spend: 300, vendas: 30, resultadoHeroi: 30, cpa: 10, ctr: 3.0 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpa: 5 }))
    expect(alertas).toHaveLength(0)
  })

  it('cliente sem dados no período atual não gera alertas', () => {
    const atual = mkMetricas({})
    const anterior = mkMetricas({ spend: 300, vendas: 30, resultadoHeroi: 30 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior))
    expect(alertas).toHaveLength(0)
  })
})

describe('avaliarSaudeCliente — formato do alerta', () => {
  it('produz alertas no formato do motor existente (id/clienteId/dataRelevante)', () => {
    const atual = mkMetricas({ spend: 400, vendas: 10, resultadoHeroi: 10, cpa: 40 })
    const anterior = mkMetricas({ spend: 400, vendas: 10, resultadoHeroi: 10, cpa: 40 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpa: 20 }))
    const a = alertas[0]
    expect(a.clienteId).toBe('c1')
    expect(a.clienteNome).toBe('Cliente Teste')
    expect(a.id).toContain('c1')
    expect(a.dataRelevante).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(a.titulo.length).toBeGreaterThan(0)
    expect(a.detalhe.length).toBeGreaterThan(0)
  })
})

describe('calcularHealthScore', () => {
  it('retorna 100 / Saudável sem alertas', () => {
    const s = calcularHealthScore('c1', [])
    expect(s.score).toBe(100)
    expect(s.rotulo).toBe('Saudável')
  })

  it('penaliza um alerta de atenção (performance) mantendo Saudável', () => {
    const s = calcularHealthScore('c1', [mkAlerta('performance_caindo', 'atencao')])
    expect(s.score).toBe(88)
    expect(s.rotulo).toBe('Saudável')
  })

  it('sem_conversao (crítico) derruba para a faixa de Atenção', () => {
    const s = calcularHealthScore('c1', [mkAlerta('sem_conversao', 'critico')])
    expect(s.score).toBe(70)
    expect(s.rotulo).toBe('Atenção')
  })

  it('soma penalidades e classifica como Crítico abaixo de 50', () => {
    const s = calcularHealthScore('c1', [
      mkAlerta('sem_conversao', 'critico'), // -30
      mkAlerta('cpa_alto', 'critico'), // -25
    ])
    expect(s.score).toBe(45)
    expect(s.rotulo).toBe('Crítico')
  })

  it('mantém piso de 0', () => {
    const s = calcularHealthScore('c1', [
      mkAlerta('sem_conversao', 'critico'),
      mkAlerta('sem_conversao', 'critico'),
      mkAlerta('sem_conversao', 'critico'),
      mkAlerta('sem_conversao', 'critico'),
    ])
    expect(s.score).toBe(0)
    expect(s.rotulo).toBe('Crítico')
  })

  it('ignora alertas de outro clienteId (defensivo)', () => {
    const s = calcularHealthScore('c1', [mkAlerta('sem_conversao', 'critico', 'outro')])
    expect(s.score).toBe(100)
    expect(s.rotulo).toBe('Saudável')
  })
})
