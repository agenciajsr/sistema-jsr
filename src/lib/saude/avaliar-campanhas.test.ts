import { describe, it, expect } from 'vitest'

import type { Heroi, MetricasIntervalo } from '@/lib/trafego/aggregate'
import type { Alerta, SeveridadeAlerta, TipoAlerta } from '@/lib/alertas/types'
import {
  avaliarSaudeCliente,
  calcularHealthScore,
  type AdStatusRow,
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
  metas: { metaCpa?: number | null; metaCpl?: number | null; ads?: AdStatusRow[] } = {},
): EntradaSaude {
  return {
    clienteId: 'c1',
    clienteNome: 'Cliente Teste',
    metaCpa: metas.metaCpa ?? null,
    metaCpl: metas.metaCpl ?? null,
    atual,
    anterior,
    ads: metas.ads,
  }
}

function mkAd(over: Partial<AdStatusRow> = {}): AdStatusRow {
  return {
    adId: 'ad1',
    adName: 'Anúncio Teste',
    effectiveStatus: null,
    frequency: null,
    impressions: 0,
    spend: 0,
    ...over,
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

describe('avaliarSaudeCliente — criativo rejeitado', () => {
  const atual = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20 })
  const anterior = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20 })

  it('gera criativo_rejeitado CRÍTICO com effective_status DISAPPROVED citando o anúncio', () => {
    const ads = [mkAd({ adName: 'Vídeo Promo', effectiveStatus: 'DISAPPROVED' })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    const a = alertas.find((x) => x.tipo === 'criativo_rejeitado')
    expect(a).toBeDefined()
    expect(a?.severidade).toBe('critico')
    expect(a?.detalhe).toContain('Vídeo Promo')
  })

  it('gera criativo_rejeitado ATENÇÃO com effective_status WITH_ISSUES', () => {
    const ads = [mkAd({ effectiveStatus: 'WITH_ISSUES' })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    const a = alertas.find((x) => x.tipo === 'criativo_rejeitado')
    expect(a).toBeDefined()
    expect(a?.severidade).toBe('atencao')
  })

  it('prioriza CRÍTICO e emite no máximo 1 alerta do tipo quando há DISAPPROVED e WITH_ISSUES', () => {
    const ads = [
      mkAd({ adId: 'a1', effectiveStatus: 'WITH_ISSUES' }),
      mkAd({ adId: 'a2', effectiveStatus: 'DISAPPROVED' }),
      mkAd({ adId: 'a3', effectiveStatus: 'DISAPPROVED' }),
    ]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    const rejeitados = alertas.filter((x) => x.tipo === 'criativo_rejeitado')
    expect(rejeitados).toHaveLength(1)
    expect(rejeitados[0].severidade).toBe('critico')
  })

  it('NÃO gera criativo_rejeitado para status PAUSED/ARCHIVED/DELETED/ACTIVE', () => {
    for (const status of ['PAUSED', 'ARCHIVED', 'DELETED', 'ACTIVE']) {
      const ads = [mkAd({ effectiveStatus: status })]
      const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
      expect(tipos(alertas)).not.toContain('criativo_rejeitado')
    }
  })
})

describe('avaliarSaudeCliente — fadiga de criativo', () => {
  const atual = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20 })
  const anterior = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20 })

  it('gera fadiga_criativo (atenção) com frequency >= 3.5 e volume mínimo, citando a frequência', () => {
    const ads = [mkAd({ adName: 'Carrossel A', frequency: 4.2, impressions: 5000 })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    const a = alertas.find((x) => x.tipo === 'fadiga_criativo')
    expect(a).toBeDefined()
    expect(a?.severidade).toBe('atencao')
    expect(a?.detalhe).toContain('4.2')
  })

  it('escolhe o anúncio de maior frequency quando há vários em fadiga', () => {
    const ads = [
      mkAd({ adId: 'a1', adName: 'Baixa', frequency: 3.6, impressions: 5000 }),
      mkAd({ adId: 'a2', adName: 'Alta', frequency: 6.0, impressions: 5000 }),
    ]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    const fadigas = alertas.filter((x) => x.tipo === 'fadiga_criativo')
    expect(fadigas).toHaveLength(1)
    expect(fadigas[0].detalhe).toContain('Alta')
  })

  it('NÃO gera fadiga_criativo quando frequency < 3.5', () => {
    const ads = [mkAd({ frequency: 2.0, impressions: 5000 })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    expect(tipos(alertas)).not.toContain('fadiga_criativo')
  })

  it('NÃO gera fadiga_criativo quando o volume está abaixo do mínimo', () => {
    const ads = [mkAd({ frequency: 5.0, impressions: 500 })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    expect(tipos(alertas)).not.toContain('fadiga_criativo')
  })
})

describe('avaliarSaudeCliente — degradação graciosa (colunas nulas)', () => {
  it('effectiveStatus e frequency nulos → nenhum alerta novo e não quebra', () => {
    const atual = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20 })
    const anterior = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 20 })
    const ads = [mkAd({ effectiveStatus: null, frequency: null, impressions: 5000 })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    expect(tipos(alertas)).not.toContain('criativo_rejeitado')
    expect(tipos(alertas)).not.toContain('fadiga_criativo')
  })

  it('criativo rejeitado avisa mesmo com gasto agregado zerado (verba parada)', () => {
    const atual = mkMetricas({ spend: 0 })
    const anterior = mkMetricas({ spend: 0 })
    const ads = [mkAd({ effectiveStatus: 'DISAPPROVED', adName: 'Parado' })]
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { ads }))
    const a = alertas.find((x) => x.tipo === 'criativo_rejeitado')
    expect(a).toBeDefined()
    expect(a?.severidade).toBe('critico')
  })

  it('sem ads (campo ausente) → comportamento idêntico ao atual', () => {
    const atual = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 40 })
    const anterior = mkMetricas({ spend: 200, vendas: 10, resultadoHeroi: 10, cpa: 40 })
    const alertas = avaliarSaudeCliente(mkEntrada(atual, anterior, { metaCpa: 20 }))
    expect(tipos(alertas)).not.toContain('criativo_rejeitado')
    expect(tipos(alertas)).not.toContain('fadiga_criativo')
    expect(tipos(alertas)).toContain('cpa_alto')
  })
})

describe('calcularHealthScore — novos sinais', () => {
  it('criativo_rejeitado crítico penaliza como crítico (25)', () => {
    const s = calcularHealthScore('c1', [mkAlerta('criativo_rejeitado', 'critico')])
    expect(s.score).toBe(75)
  })

  it('fadiga_criativo penaliza como atenção (12)', () => {
    const s = calcularHealthScore('c1', [mkAlerta('fadiga_criativo', 'atencao')])
    expect(s.score).toBe(88)
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
