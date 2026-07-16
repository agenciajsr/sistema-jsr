import { describe, it, expect } from 'vitest'

import {
  deduplicarJanelaMaisRecente,
  agregarDemografia,
  rankingDeRegioes,
  LIMIAR_COBERTURA_REGIAO,
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
  it('modo herói: cobertura total -> agrega por região (somando campanhas), custo por resultado e ordem por resultados desc', () => {
    const rows = [
      linhaRegiao({ campaignId: 'c1', region: 'Sao Paulo', spend: '10.00', actions: [{ action_type: 'lead', value: '2' }] }),
      linhaRegiao({ campaignId: 'c2', region: 'Sao Paulo', spend: '20.00', actions: [{ action_type: 'lead', value: '4' }] }),
      linhaRegiao({ campaignId: 'c1', region: 'Minas Gerais', spend: '5.00', actions: [{ action_type: 'lead', value: '10' }] }),
    ]
    const { metrica, motivo, linhas } = rankingDeRegioes(rows, 'leads', 16)
    expect(metrica).toBe('heroi')
    expect(motivo).toBe('heroi')
    expect(linhas[0].region).toBe('Minas Gerais')
    expect(linhas[0].resultados).toBe(10)
    expect(linhas[0].custoPorResultado).toBeCloseTo(0.5)
    expect(linhas[1].region).toBe('Sao Paulo')
    expect(linhas[1].resultados).toBe(6)
    expect(linhas[1].spend).toBeCloseTo(30)
    expect(linhas[1].custoPorResultado).toBeCloseTo(5)
  })

  it('REGRESSÃO (caso real Melzinho): 1 compra por região de 412 reais (0,2%) -> fallback por cobertura, NÃO modo herói', () => {
    // O bug que motivou a task: 1 onsite_conversion.purchase (compra dentro do
    // Instagram, que escapa da restrição de privacidade) fazia `soma > 0` dar
    // verdadeiro e o card seguia "Regiões que mais vendem" com ZERO no resto.
    const rows = [
      linhaRegiao({
        region: 'Sao Paulo',
        spend: '6561.87',
        actions: [
          { action_type: 'onsite_conversion.purchase', value: '1' },
          { action_type: 'link_click', value: '9784' },
        ],
      }),
      linhaRegiao({
        region: 'Minas Gerais',
        spend: '2102.68',
        actions: [{ action_type: 'link_click', value: '3471' }],
      }),
    ]
    const { metrica, motivo, linhas } = rankingDeRegioes(rows, 'vendas', 412)
    expect(metrica).toBe('linkClicks')
    expect(motivo).toBe('sem-cobertura')
    expect(linhas[0].region).toBe('Sao Paulo')
    expect(linhas[0].linkClicks).toBe(9784)
    expect(linhas[0].custoPorResultado).toBeCloseTo(6561.87 / 9784)
  })

  it('cobertura < limiar: ranqueia por cliques no link, com custo por clique no link', () => {
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
    const { metrica, motivo, linhas } = rankingDeRegioes(rows, 'vendas', 100)
    expect(metrica).toBe('linkClicks')
    expect(motivo).toBe('sem-cobertura')
    expect(linhas[0].region).toBe('Bahia')
    expect(linhas[0].linkClicks).toBe(500)
    expect(linhas[0].resultados).toBe(0)
    expect(linhas[0].custoPorResultado).toBeCloseTo(0.1) // 50 / 500
    expect(linhas[1].region).toBe('Sao Paulo')
    expect(linhas[1].linkClicks).toBe(200)
    expect(linhas[1].custoPorResultado).toBeCloseTo(0.5) // 100 / 200
  })

  it('a regra é dirigida pelo DADO: conversas onsite chegam por região com cobertura total -> modo herói', () => {
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
    const { metrica, motivo, linhas } = rankingDeRegioes(rows, 'conversas', 9)
    expect(metrica).toBe('heroi')
    expect(motivo).toBe('heroi')
    expect(linhas[0].resultados).toBe(9)
    expect(linhas[0].linkClicks).toBe(400)
    expect(linhas[0].custoPorResultado).toBeCloseTo(10)
  })

  it('cobertura EXATAMENTE no limiar (0.5) -> modo herói (fixa a borda)', () => {
    const rows = [
      linhaRegiao({
        region: 'Sao Paulo',
        spend: '50.00',
        actions: [
          { action_type: 'lead', value: '5' },
          { action_type: 'link_click', value: '900' },
        ],
      }),
    ]
    const { metrica, motivo } = rankingDeRegioes(rows, 'leads', 10)
    expect(LIMIAR_COBERTURA_REGIAO).toBe(0.5)
    expect(metrica).toBe('heroi')
    expect(motivo).toBe('heroi')
  })

  it('totalReferencia = 0 (cliente sem resultado no período): fallback com motivo sem-resultados — não é limitação do Meta', () => {
    const { metrica, motivo, linhas } = rankingDeRegioes(
      [linhaRegiao({ actions: [{ action_type: 'link_click', value: '30' }], spend: '10.00' })],
      'vendas',
      0,
    )
    expect(metrica).toBe('linkClicks')
    expect(motivo).toBe('sem-resultados')
    expect(linhas[0].linkClicks).toBe(30)
  })

  it('tudo zerado (actions null, sem spend): não lança e custoPorResultado é null', () => {
    const { metrica, motivo, linhas } = rankingDeRegioes(
      [linhaRegiao({ actions: null, spend: '0.00' })],
      'vendas',
      0,
    )
    expect(metrica).toBe('linkClicks')
    expect(motivo).toBe('sem-resultados')
    expect(linhas[0].resultados).toBe(0)
    expect(linhas[0].linkClicks).toBe(0)
    expect(linhas[0].custoPorResultado).toBeNull()
  })

  it('lista vazia: linhas vazias e não lança', () => {
    const ranking = rankingDeRegioes([], 'leads', 0)
    expect(ranking.linhas).toEqual([])
    expect(ranking.metrica).toBe('heroi')
    expect(ranking.motivo).toBe('heroi')
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
