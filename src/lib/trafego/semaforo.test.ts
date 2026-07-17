import { describe, expect, it } from 'vitest'

import {
  breakdownDoCliente,
  metricasDaCampanha,
  piorStatus,
  resolverMetas,
  scoreSemaforo,
  statusDaMetrica,
} from './semaforo'
import { calcularMetricas, totaisVazios } from './metricas'

const amostraOk = { impressions: 5000, spend: 200 }

describe('statusDaMetrica', () => {
  it('menor melhor (CPL): bom no limite, atenção entre, ruim acima do warn', () => {
    const meta = { bom: 15, ruim: 20 }
    expect(statusDaMetrica('custoPorLead', 15, meta, amostraOk)).toBe('bom')
    expect(statusDaMetrica('custoPorLead', 18, meta, amostraOk)).toBe('atencao')
    expect(statusDaMetrica('custoPorLead', 21, meta, amostraOk)).toBe('ruim')
  })

  it('maior melhor (ROAS): bom no limite, atenção entre, ruim abaixo do warn', () => {
    const meta = { bom: 3, ruim: 2 }
    expect(statusDaMetrica('roas', 3, meta, amostraOk)).toBe('bom')
    expect(statusDaMetrica('roas', 2.5, meta, amostraOk)).toBe('atencao')
    expect(statusDaMetrica('roas', 1.9, meta, amostraOk)).toBe('ruim')
  })

  it('amostra insignificante vira sem_dados, nunca vermelho (critério de aceite: 300 impressões + CPL alto = cinza)', () => {
    const meta = { bom: 15, ruim: 20 }
    expect(statusDaMetrica('custoPorLead', 99, meta, { impressions: 300, spend: 200 })).toBe('sem_dados')
    expect(statusDaMetrica('custoPorLead', 99, meta, { impressions: 5000, spend: 5 })).toBe('sem_dados')
  })

  it('sem meta monitorada retorna null (sem chip); valor null vira sem_dados', () => {
    expect(statusDaMetrica('custoPorLead', 10, undefined, amostraOk)).toBeNull()
    expect(statusDaMetrica('custoPorLead', null, { bom: 15, ruim: 20 }, amostraOk)).toBe('sem_dados')
  })
})

describe('resolverMetas', () => {
  it('cliente sem metas usa defaults do objetivo (critério de aceite)', () => {
    const metas = resolverMetas(null, 'leads')
    expect(metas.get('custoPorLead')).toEqual({ bom: 15, ruim: 20 })
    expect(metas.get('ctrLink')).toEqual({ bom: 1.5, ruim: 1.0 })
  })

  it('meta salva ativa vence o default; meta desativada some (inclusive default)', () => {
    const metas = resolverMetas(
      [
        { id: 'custoPorLead', ativo: true, meta: { bom: 8, ruim: 12, ativa: true } },
        { id: 'cpm', ativo: true, meta: { bom: 30, ruim: 40, ativa: false } },
      ],
      'leads',
    )
    expect(metas.get('custoPorLead')).toEqual({ bom: 8, ruim: 12 })
    expect(metas.has('cpm')).toBe(false)
  })

  it('classe null sem metas salvas = mapa vazio (nenhum chip)', () => {
    expect(resolverMetas(null, null).size).toBe(0)
  })
})

describe('piorStatus', () => {
  it('ruim > atenção > bom; sem_dados só quando é o único', () => {
    expect(piorStatus(['bom', 'ruim', 'atencao'])).toBe('ruim')
    expect(piorStatus(['bom', 'atencao'])).toBe('atencao')
    expect(piorStatus(['bom', 'sem_dados'])).toBe('bom')
    expect(piorStatus(['sem_dados'])).toBe('sem_dados')
    expect(piorStatus([])).toBeNull()
  })
})

describe('scoreSemaforo', () => {
  const metas = resolverMetas(null, 'leads')

  it('campanha toda verde = 100/Saudável; toda vermelha = 20/Crítico', () => {
    // CPL 10 (bom), CTR link 2% (bom), CPC link 1 (bom), CPM 20 (bom)
    const boa = { spend: 100, impressions: 5000, linkClicks: 100, receita: 0, resultadoHeroi: 10 }
    expect(scoreSemaforo([boa], metas)?.rotulo).toBe('Saudável')

    // CPL 50 (ruim), CTR 0.2% (ruim), CPC 10 (ruim), CPM 50 (ruim)
    const ruim = { spend: 250, impressions: 5000, linkClicks: 25, receita: 0, resultadoHeroi: 5 }
    const s = scoreSemaforo([ruim], metas)
    expect(s?.score).toBe(20)
    expect(s?.rotulo).toBe('Crítico')
  })

  it('pondera pelo gasto: campanha ruim com gasto maior puxa o score pra baixo', () => {
    const boa = { spend: 50, impressions: 5000, linkClicks: 100, receita: 0, resultadoHeroi: 10 }
    const ruim = { spend: 450, impressions: 9000, linkClicks: 45, receita: 0, resultadoHeroi: 9 }
    const s = scoreSemaforo([boa, ruim], metas)
    expect(s).not.toBeNull()
    expect(s!.score).toBeLessThan(50)
  })

  it('sem campanha avaliável retorna null (quem chama usa fallback)', () => {
    expect(scoreSemaforo([], metas)).toBeNull()
    const semAmostra = { spend: 5, impressions: 100, linkClicks: 1, receita: 0, resultadoHeroi: 0 }
    expect(scoreSemaforo([semAmostra], metas)).toBeNull()
  })
})

describe('metricasDaCampanha', () => {
  it('deriva custo/resultado, roas, ctrLink, cpcLink e cpm; denominador zero vira null', () => {
    const m = metricasDaCampanha({ spend: 100, impressions: 10000, linkClicks: 200, receita: 300, resultadoHeroi: 10 })
    expect(m.custoPorResultado).toBe(10)
    expect(m.roas).toBe(3)
    expect(m.ctrLink).toBe(2)
    expect(m.cpcLink).toBe(0.5)
    expect(m.cpm).toBe(10)
    const vazio = metricasDaCampanha({ spend: 0, impressions: 0, linkClicks: 0, receita: 0, resultadoHeroi: 0 })
    expect(vazio.custoPorResultado).toBeNull()
    expect(vazio.ctrLink).toBeNull()
  })
})

describe('breakdownDoCliente', () => {
  it('uma linha por métrica monitorada, ordenada do pior para o melhor', () => {
    const totais = { ...totaisVazios(), spend: 300, impressions: 10000, linkClicks: 100, leads: 10, resultadoHeroi: 10 }
    const metricas = calcularMetricas(totais)
    const metas = resolverMetas(null, 'leads')
    const itens = breakdownDoCliente(metricas, metas, { impressions: totais.impressions, spend: totais.spend })
    expect(itens.length).toBe(metas.size)
    const ordem: Record<string, number> = { ruim: 0, atencao: 1, bom: 2, sem_dados: 3 }
    for (let i = 1; i < itens.length; i++) {
      expect(ordem[itens[i - 1].status]).toBeLessThanOrEqual(ordem[itens[i].status])
    }
  })
})
