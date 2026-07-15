import { describe, it, expect } from 'vitest'

import {
  parseActionsExtendido,
  calcularMetricas,
  variacao,
  variacaoEBoa,
  CATALOGO_METRICAS,
  type TotaisPeriodo,
} from './metricas'

// Helper: linha de actions no formato da Meta
const a = (action_type: string, value: string) => ({ action_type, value })

function totaisBase(overrides: Partial<TotaisPeriodo> = {}): TotaisPeriodo {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    leads: 0,
    vendas: 0,
    conversas: 0,
    linkClicks: 0,
    adicoesCarrinho: 0,
    visualizacoesLp: 0,
    engajamento: 0,
    receita: 0,
    resultadoHeroi: 0,
    ...overrides,
  }
}

describe('parseActionsExtendido', () => {
  it('retorna tudo 0 para null/undefined/lixo', () => {
    for (const lixo of [null, undefined, 'x', 42, {}, [{ foo: 'bar' }]]) {
      const r = parseActionsExtendido(lixo)
      expect(r.leads).toBe(0)
      expect(r.vendas).toBe(0)
      expect(r.conversas).toBe(0)
      expect(r.linkClicks).toBe(0)
      expect(r.adicoesCarrinho).toBe(0)
      expect(r.visualizacoesLp).toBe(0)
      expect(r.engajamento).toBe(0)
      expect(r.videoViews).toBe(0)
    }
  })

  it('extrai leads/vendas/conversas/linkClicks como o parseActions base', () => {
    const r = parseActionsExtendido([
      a('lead', '3'),
      a('omni_purchase', '2'),
      a('purchase', '2'), // ignorado: dedup por prioridade
      a('onsite_conversion.messaging_conversation_started_7d', '5'),
      a('link_click', '40'),
    ])
    expect(r.leads).toBe(3)
    expect(r.vendas).toBe(2)
    expect(r.conversas).toBe(5)
    expect(r.linkClicks).toBe(40)
  })

  it('deduplica adições ao carrinho por prioridade (omni > add_to_cart > pixel)', () => {
    const r = parseActionsExtendido([
      a('omni_add_to_cart', '7'),
      a('add_to_cart', '7'),
      a('offsite_conversion.fb_pixel_add_to_cart', '7'),
    ])
    expect(r.adicoesCarrinho).toBe(7)
  })

  it('usa add_to_cart quando não há omni', () => {
    const r = parseActionsExtendido([
      a('add_to_cart', '4'),
      a('offsite_conversion.fb_pixel_add_to_cart', '4'),
    ])
    expect(r.adicoesCarrinho).toBe(4)
  })

  it('deduplica visualizações de página de destino (omni > landing_page_view)', () => {
    const r = parseActionsExtendido([
      a('omni_landing_page_view', '120'),
      a('landing_page_view', '120'),
    ])
    expect(r.visualizacoesLp).toBe(120)
  })

  it('extrai engajamento (page_engagement > post_engagement) e video_view', () => {
    const r1 = parseActionsExtendido([
      a('page_engagement', '500'),
      a('post_engagement', '480'),
    ])
    expect(r1.engajamento).toBe(500)

    const r2 = parseActionsExtendido([a('post_engagement', '480'), a('video_view', '99')])
    expect(r2.engajamento).toBe(480)
    expect(r2.videoViews).toBe(99)
  })
})

describe('calcularMetricas', () => {
  it('computa derivadas com denominadores válidos', () => {
    const m = calcularMetricas(
      totaisBase({
        spend: 1000,
        impressions: 100_000,
        clicks: 2000,
        reach: 50_000,
        leads: 40,
        vendas: 10,
        conversas: 20,
        linkClicks: 1000,
        adicoesCarrinho: 30,
        visualizacoesLp: 800,
        engajamento: 5000,
        receita: 4000,
        resultadoHeroi: 10,
      }),
    )
    expect(m.investimento).toBe(1000)
    expect(m.valorEmCompras).toBe(4000)
    expect(m.roas).toBe(4) // 4000/1000
    expect(m.cpaMedio).toBe(100) // 1000/10
    expect(m.ticketMedio).toBe(400) // 4000/10
    expect(m.adicoesCarrinho).toBe(30)
    expect(m.compras).toBe(10)
    expect(m.conversas).toBe(20)
    expect(m.custoPorConversa).toBe(50) // 1000/20
    expect(m.leads).toBe(40)
    expect(m.custoPorLead).toBe(25) // 1000/40
    expect(m.impressoes).toBe(100_000)
    expect(m.alcance).toBe(50_000)
    expect(m.cliques).toBe(2000)
    expect(m.cliquesNoLink).toBe(1000)
    expect(m.ctrTodos).toBe(2) // 2000/100000*100
    expect(m.ctrLink).toBe(1) // 1000/100000*100
    expect(m.cpm).toBe(10) // 1000/100000*1000
    expect(m.cpcMedio).toBe(0.5) // 1000/2000
    expect(m.cpcLink).toBe(1) // 1000/1000
    expect(m.visualizacoesLp).toBe(800)
    expect(m.engajamento).toBe(5000)
    expect(m.resultados).toBe(10)
    expect(m.custoPorResultado).toBe(100) // 1000/10
  })

  it('retorna null nas derivadas quando o denominador é 0 (volumes continuam 0)', () => {
    const m = calcularMetricas(totaisBase({ spend: 500 }))
    expect(m.investimento).toBe(500)
    expect(m.roas).toBeNull() // sem spend? aqui receita 0 -> roas null
    expect(m.cpaMedio).toBeNull()
    expect(m.ticketMedio).toBeNull()
    expect(m.custoPorConversa).toBeNull()
    expect(m.custoPorLead).toBeNull()
    expect(m.ctrTodos).toBeNull()
    expect(m.ctrLink).toBeNull()
    expect(m.cpm).toBeNull()
    expect(m.cpcMedio).toBeNull()
    expect(m.cpcLink).toBeNull()
    expect(m.custoPorResultado).toBeNull()
    // Volumes zerados aparecem como 0, nunca null (card mostra 0, não some)
    expect(m.leads).toBe(0)
    expect(m.compras).toBe(0)
    expect(m.impressoes).toBe(0)
  })

  it('roas é null quando spend é 0 mesmo com receita', () => {
    const m = calcularMetricas(totaisBase({ receita: 100 }))
    expect(m.roas).toBeNull()
  })
})

describe('variacao', () => {
  it('calcula % de variação', () => {
    expect(variacao(150, 100)).toBe(50)
    expect(variacao(50, 100)).toBe(-50)
    expect(variacao(100, 100)).toBe(0)
  })

  it('retorna null quando anterior é 0 ou null, ou atual é null', () => {
    expect(variacao(100, 0)).toBeNull()
    expect(variacao(100, null)).toBeNull()
    expect(variacao(null, 100)).toBeNull()
  })
})

describe('variacaoEBoa', () => {
  it('custo subindo = ruim, custo caindo = bom', () => {
    expect(variacaoEBoa('custoPorLead', 10)).toBe(false)
    expect(variacaoEBoa('custoPorLead', -10)).toBe(true)
    expect(variacaoEBoa('cpm', 5)).toBe(false)
    expect(variacaoEBoa('cpaMedio', -5)).toBe(true)
    expect(variacaoEBoa('investimento', 10)).toBe(false)
  })

  it('volume/receita/taxa subindo = bom', () => {
    expect(variacaoEBoa('leads', 10)).toBe(true)
    expect(variacaoEBoa('leads', -10)).toBe(false)
    expect(variacaoEBoa('valorEmCompras', 10)).toBe(true)
    expect(variacaoEBoa('roas', 10)).toBe(true)
    expect(variacaoEBoa('ctrTodos', -1)).toBe(false)
  })
})

describe('CATALOGO_METRICAS', () => {
  it('contém todas as métricas esperadas, com id/label/formato/tipo', () => {
    const ids = CATALOGO_METRICAS.map((m) => m.id)
    const esperadas = [
      'investimento',
      'valorEmCompras',
      'roas',
      'cpaMedio',
      'ticketMedio',
      'adicoesCarrinho',
      'compras',
      'conversas',
      'custoPorConversa',
      'leads',
      'custoPorLead',
      'impressoes',
      'alcance',
      'cliques',
      'cliquesNoLink',
      'ctrTodos',
      'ctrLink',
      'cpm',
      'cpcMedio',
      'cpcLink',
      'visualizacoesLp',
      'engajamento',
      'resultados',
      'custoPorResultado',
    ]
    for (const id of esperadas) expect(ids).toContain(id)
    for (const m of CATALOGO_METRICAS) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(['moeda', 'numero', 'pct', 'multiplicador']).toContain(m.formato)
      expect(['custo', 'volume', 'taxa']).toContain(m.tipo)
    }
  })
})
