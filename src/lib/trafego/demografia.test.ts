import { describe, it, expect } from 'vitest'

import {
  deduplicarJanelaMaisRecente,
  agregarDemografia,
  rankingDeRegioes,
  objetivoDaCampanha,
  type LinhaDemografiaBruta,
  type LinhaRegiaoBruta,
} from './demografia'

function linhaDemo(over: Partial<LinhaDemografiaBruta> = {}): LinhaDemografiaBruta {
  return {
    campaignId: 'c1',
    campaignName: 'Campanha 1',
    age: '18-24',
    gender: 'male',
    spend: '10.00',
    impressions: 100,
    clicks: 5,
    actions: [{ action_type: 'lead', value: '3' }],
    actionValues: null,
    dateStop: '2026-07-15',
    ...over,
  }
}

function linhaRegiao(over: Partial<LinhaRegiaoBruta> = {}): LinhaRegiaoBruta {
  return {
    campaignId: 'c1',
    campaignName: 'Campanha 1',
    region: 'Sao Paulo',
    spend: '10.00',
    impressions: 100,
    clicks: 5,
    actions: [{ action_type: 'lead', value: '3' }],
    actionValues: null,
    dateStop: '2026-07-15',
    ...over,
  }
}

describe('deduplicarJanelaMaisRecente', () => {
  it('mantém só a janela mais recente por chave (maior dateStop)', () => {
    const rows = [
      linhaDemo({ dateStop: '2026-07-13', spend: '5.00' }),
      linhaDemo({ dateStop: '2026-07-15', spend: '10.00' }),
      linhaDemo({ dateStop: '2026-07-14', spend: '7.00' }),
    ]
    const dedup = deduplicarJanelaMaisRecente(rows, (r) => `${r.campaignId}|${r.age}|${r.gender}`)
    expect(dedup).toHaveLength(1)
    expect(dedup[0].dateStop).toBe('2026-07-15')
    expect(dedup[0].spend).toBe('10.00')
  })

  it('não mistura chaves diferentes', () => {
    const rows = [
      linhaDemo({ gender: 'male', dateStop: '2026-07-14' }),
      linhaDemo({ gender: 'female', dateStop: '2026-07-15' }),
    ]
    const dedup = deduplicarJanelaMaisRecente(rows, (r) => `${r.campaignId}|${r.age}|${r.gender}`)
    expect(dedup).toHaveLength(2)
  })
})

describe('agregarDemografia', () => {
  it('agrega por faixa etária × gênero somando spend/impressions/clicks e extraindo resultados via actions', () => {
    const rows = [
      linhaDemo({
        campaignId: 'c1',
        age: '18-24',
        gender: 'male',
        spend: '10.50',
        impressions: 100,
        clicks: 5,
        actions: [
          { action_type: 'lead', value: '3' },
          { action_type: 'omni_purchase', value: '2' },
          { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '4' },
        ],
      }),
      linhaDemo({
        campaignId: 'c2',
        campaignName: 'Campanha 2',
        age: '18-24',
        gender: 'male',
        spend: '4.50',
        impressions: 50,
        clicks: 2,
        actions: [{ action_type: 'lead', value: '1' }],
      }),
    ]
    const linhas = agregarDemografia(rows)
    // Mantém quebra por campanha (a UI filtra por campanha client-side)
    expect(linhas).toHaveLength(2)
    const c1 = linhas.find((l) => l.campaignId === 'c1')!
    expect(c1.spend).toBeCloseTo(10.5)
    expect(c1.impressions).toBe(100)
    expect(c1.clicks).toBe(5)
    expect(c1.leads).toBe(3)
    expect(c1.compras).toBe(2)
    expect(c1.conversas).toBe(4)
    const c2 = linhas.find((l) => l.campaignId === 'c2')!
    expect(c2.leads).toBe(1)
  })

  it('actions nulas viram zeros (nunca lança)', () => {
    const [linha] = agregarDemografia([linhaDemo({ actions: null })])
    expect(linha.leads).toBe(0)
    expect(linha.compras).toBe(0)
    expect(linha.conversas).toBe(0)
  })
})

describe('rankingDeRegioes', () => {
  it('modo herói: há resultados da chave -> agrega por região (somando campanhas), custo por resultado e ordem por resultados desc', () => {
    const rows = [
      linhaRegiao({ campaignId: 'c1', region: 'Sao Paulo', spend: '10.00', actions: [{ action_type: 'lead', value: '2' }] }),
      linhaRegiao({ campaignId: 'c2', region: 'Sao Paulo', spend: '20.00', actions: [{ action_type: 'lead', value: '4' }] }),
      linhaRegiao({ campaignId: 'c1', region: 'Minas Gerais', spend: '5.00', actions: [{ action_type: 'lead', value: '10' }] }),
    ]
    const { metrica, linhas } = rankingDeRegioes(rows, 'leads')
    expect(metrica).toBe('heroi')
    expect(linhas[0].region).toBe('Minas Gerais')
    expect(linhas[0].resultados).toBe(10)
    expect(linhas[0].custoPorResultado).toBeCloseTo(0.5)
    expect(linhas[1].region).toBe('Sao Paulo')
    expect(linhas[1].resultados).toBe(6)
    expect(linhas[1].spend).toBeCloseTo(30)
    expect(linhas[1].custoPorResultado).toBeCloseTo(5)
  })

  it('modo fallback: chave sem nenhum resultado por região -> ranqueia por cliques no link, com custo por clique no link', () => {
    // Caso real: o Meta não entrega conversão de pixel por região, só link_click/page_engagement.
    const rows = [
      linhaRegiao({
        campaignId: 'c1',
        region: 'Sao Paulo',
        spend: '100.00',
        actions: [
          { action_type: 'link_click', value: '200' },
          { action_type: 'page_engagement', value: '300' },
        ],
      }),
      linhaRegiao({
        campaignId: 'c1',
        region: 'Bahia',
        spend: '50.00',
        actions: [
          { action_type: 'link_click', value: '500' },
          { action_type: 'page_engagement', value: '600' },
        ],
      }),
    ]
    const { metrica, linhas } = rankingDeRegioes(rows, 'vendas')
    expect(metrica).toBe('linkClicks')
    expect(linhas[0].region).toBe('Bahia')
    expect(linhas[0].linkClicks).toBe(500)
    expect(linhas[0].resultados).toBe(0)
    expect(linhas[0].custoPorResultado).toBeCloseTo(0.1) // 50 / 500
    expect(linhas[1].region).toBe('Sao Paulo')
    expect(linhas[1].linkClicks).toBe(200)
    expect(linhas[1].custoPorResultado).toBeCloseTo(0.5) // 100 / 200
  })

  it('a regra é dirigida pelo DADO: conversas onsite chegam por região -> modo herói (nada de hardcode por cliente)', () => {
    const rows = [
      linhaRegiao({
        region: 'Sao Paulo',
        spend: '90.00',
        actions: [
          { action_type: 'onsite_conversion.total_messaging_connection', value: '9' },
          { action_type: 'link_click', value: '400' },
        ],
      }),
    ]
    const { metrica, linhas } = rankingDeRegioes(rows, 'conversas')
    expect(metrica).toBe('heroi')
    expect(linhas[0].resultados).toBe(9)
    expect(linhas[0].linkClicks).toBe(400)
    expect(linhas[0].custoPorResultado).toBeCloseTo(10)
  })

  it('tudo zerado (actions null, sem spend): cai no fallback, custoPorResultado null e não lança', () => {
    const { metrica, linhas } = rankingDeRegioes(
      [linhaRegiao({ actions: null, spend: '0.00' })],
      'vendas',
    )
    expect(metrica).toBe('linkClicks')
    expect(linhas[0].resultados).toBe(0)
    expect(linhas[0].linkClicks).toBe(0)
    expect(linhas[0].custoPorResultado).toBeNull()
  })

  it('lista vazia: linhas vazias e não lança', () => {
    const ranking = rankingDeRegioes([], 'leads')
    expect(ranking.linhas).toEqual([])
    expect(ranking.metrica).toBe('heroi')
  })
})

describe('objetivoDaCampanha', () => {
  it('mapeia objective oficial da Meta para o rótulo do chip', () => {
    expect(objetivoDaCampanha('OUTCOME_SALES', null)).toBe('VENDAS')
    expect(objetivoDaCampanha('OUTCOME_LEADS', null)).toBe('LEADS')
    expect(objetivoDaCampanha('OUTCOME_ENGAGEMENT', null)).toBe('ENGAJAMENTO')
    expect(objetivoDaCampanha('OUTCOME_TRAFFIC', null)).toBe('TRAFEGO')
    expect(objetivoDaCampanha('OUTCOME_AWARENESS', null)).toBe('RECONHECIMENTO')
    expect(objetivoDaCampanha('OUTCOME_APP_PROMOTION', null)).toBe('APP')
  })

  it('mapeia objectives legados (pré-OUTCOME)', () => {
    expect(objetivoDaCampanha('MESSAGES', null)).toBe('CONVERSAS')
    expect(objetivoDaCampanha('CONVERSIONS', null)).toBe('VENDAS')
    expect(objetivoDaCampanha('LEAD_GENERATION', null)).toBe('LEADS')
    expect(objetivoDaCampanha('LINK_CLICKS', null)).toBe('TRAFEGO')
  })

  it('quando objective é null, cai no fallback classificarObjetivo (objetivo cadastrado do cliente)', () => {
    expect(objetivoDaCampanha(null, 'vender no whatsapp')).toBe('CONVERSAS')
    expect(objetivoDaCampanha(null, 'captar leads de formulário')).toBe('LEADS')
    expect(objetivoDaCampanha(null, 'aumentar vendas da loja')).toBe('VENDAS')
  })

  it('objective desconhecido E fallback sem classificação -> null', () => {
    expect(objetivoDaCampanha('OBJETIVO_INVENTADO', null)).toBeNull()
    expect(objetivoDaCampanha(null, null)).toBeNull()
    expect(objetivoDaCampanha(null, 'texto que nada classifica')).toBeNull()
  })
})
