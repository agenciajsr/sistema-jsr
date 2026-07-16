import { describe, it, expect } from 'vitest'

import { presetsKpis, resolverPreferencias, type ItemGrade } from './presets-kpis'
import { CATALOGO_METRICAS } from './metricas'

const ativos = (g: ItemGrade[]) => g.filter((p) => p.ativo).map((p) => p.id)

describe('presetsKpis', () => {
  it('inclui TODO o catálogo (nada some do Organizar), só desligado no fim', () => {
    for (const classe of ['vendas', 'leads', 'conversas', 'trafego', 'engajamento'] as const) {
      const g = presetsKpis(classe)
      expect(g).toHaveLength(CATALOGO_METRICAS.length)
      const ids = new Set(g.map((p) => p.id))
      for (const m of CATALOGO_METRICAS) expect(ids.has(m.id)).toBe(true)
    }
  })

  it('vendas abre com ROAS/Compras/Valor em Compras ligados (exemplo do Emílio)', () => {
    const g = presetsKpis('vendas')
    expect(ativos(g)).toEqual([
      'investimento',
      'valorEmCompras',
      'roas',
      'compras',
      'cpaMedio',
      'ticketMedio',
      'adicoesCarrinho',
      'ctrLink',
    ])
  })

  it('conversas abre com Conversas/Custo por Conversa ligados (exemplo do Yuri)', () => {
    const g = presetsKpis('conversas')
    expect(ativos(g)).toEqual([
      'investimento',
      'conversas',
      'custoPorConversa',
      'cliquesNoLink',
      'ctrLink',
      'cpcLink',
      'impressoes',
    ])
  })

  it('preset preserva a ordem das ativas no topo da grade', () => {
    const g = presetsKpis('leads')
    const topo = g.slice(0, 7).map((p) => p.id)
    expect(topo).toEqual([
      'investimento',
      'leads',
      'custoPorLead',
      'cliquesNoLink',
      'ctrLink',
      'cpcLink',
      'visualizacoesLp',
    ])
    // O resto entra desligado
    expect(g.slice(7).every((p) => !p.ativo)).toBe(true)
  })

  it('classe null = fallback honesto: catálogo inteiro, tudo ligado', () => {
    const g = presetsKpis(null)
    expect(g).toHaveLength(CATALOGO_METRICAS.length)
    expect(g.every((p) => p.ativo)).toBe(true)
    expect(g.map((p) => p.id)).toEqual(CATALOGO_METRICAS.map((m) => m.id))
  })
})

describe('resolverPreferencias', () => {
  it('sem preferência salva usa o preset da classe', () => {
    const g = resolverPreferencias(null, 'vendas')
    expect(g).toEqual(presetsKpis('vendas'))
  })

  it('preferência salva SEMPRE vence o preset', () => {
    const salvas: ItemGrade[] = [
      { id: 'leads', ativo: true },
      { id: 'investimento', ativo: true },
    ]
    const g = resolverPreferencias(salvas, 'vendas')
    // As duas salvas ficam no topo, na ordem salva (não na ordem do preset de vendas)
    expect(g[0].id).toBe('leads')
    expect(g[1].id).toBe('investimento')
  })

  it('métricas novas do catálogo (fora da salva) entram no fim, ligadas', () => {
    const salvas: ItemGrade[] = [{ id: 'investimento', ativo: true }]
    const g = resolverPreferencias(salvas, 'leads')
    const novas = g.filter((p) => p.id !== 'investimento')
    expect(novas.length).toBe(CATALOGO_METRICAS.length - 1)
    expect(novas.every((p) => p.ativo)).toBe(true)
  })

  it('descarta ids inválidos que não existem no catálogo', () => {
    const salvas: ItemGrade[] = [
      { id: 'investimento', ativo: true },
      { id: 'metrica_fantasma', ativo: true },
    ]
    const g = resolverPreferencias(salvas, 'leads')
    expect(g.some((p) => p.id === 'metrica_fantasma')).toBe(false)
  })

  it('GUARD: salva com TUDO desligado não gera grade vazia — cai no preset (caso Ramon)', () => {
    const salvas: ItemGrade[] = CATALOGO_METRICAS.map((m) => ({ id: m.id, ativo: false }))
    const g = resolverPreferencias(salvas, 'leads')
    expect(g).toEqual(presetsKpis('leads'))
    expect(g.some((p) => p.ativo)).toBe(true)
  })

  it('GUARD: salva vazia ([]) cai no preset', () => {
    const g = resolverPreferencias([], 'conversas')
    expect(g).toEqual(presetsKpis('conversas'))
  })
})
