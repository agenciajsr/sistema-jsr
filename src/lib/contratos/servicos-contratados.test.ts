import { describe, it, expect } from 'vitest'

import {
  servicosContratadosSchema,
  somaServicos,
  descricaoObjetoServicos,
  rotuloPlataformas,
  rotuloServicoUi,
  type ServicoContratado,
} from './servicos-contratados'

describe('servicosContratadosSchema', () => {
  it('aceita tráfego pago com valor e plataforma', () => {
    const r = servicosContratadosSchema.safeParse([
      { servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads'] },
    ])
    expect(r.success).toBe(true)
  })

  it('aceita múltiplos serviços, cada um com seu valor', () => {
    const r = servicosContratadosSchema.safeParse([
      { servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads', 'google_ads'] },
      { servico: 'crm_automacao', valor: 800 },
    ])
    expect(r.success).toBe(true)
  })

  it('rejeita array vazio (mínimo 1 serviço)', () => {
    expect(servicosContratadosSchema.safeParse([]).success).toBe(false)
  })

  it('rejeita valor zero ou negativo', () => {
    expect(
      servicosContratadosSchema.safeParse([{ servico: 'estrategia', valor: 0 }]).success
    ).toBe(false)
    expect(
      servicosContratadosSchema.safeParse([{ servico: 'estrategia', valor: -10 }]).success
    ).toBe(false)
  })

  it('rejeita serviço duplicado', () => {
    const r = servicosContratadosSchema.safeParse([
      { servico: 'landing_page', valor: 500 },
      { servico: 'landing_page', valor: 700 },
    ])
    expect(r.success).toBe(false)
  })

  it('rejeita tráfego pago sem plataformas (ausente ou vazio)', () => {
    expect(
      servicosContratadosSchema.safeParse([{ servico: 'trafego_pago', valor: 1500 }]).success
    ).toBe(false)
    expect(
      servicosContratadosSchema.safeParse([
        { servico: 'trafego_pago', valor: 1500, plataformas: [] },
      ]).success
    ).toBe(false)
  })

  it('rejeita plataformas em serviço que não é tráfego pago', () => {
    const r = servicosContratadosSchema.safeParse([
      { servico: 'crm_automacao', valor: 800, plataformas: ['meta_ads'] },
    ])
    expect(r.success).toBe(false)
  })
})

describe('somaServicos', () => {
  it('soma os valores dos serviços', () => {
    const itens: ServicoContratado[] = [
      { servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads'] },
      { servico: 'crm_automacao', valor: 800 },
    ]
    expect(somaServicos(itens)).toBe(2300)
  })

  it('arredonda a 2 casas (sem erro grosseiro de float)', () => {
    const itens: ServicoContratado[] = [
      { servico: 'trafego_pago', valor: 1500.5, plataformas: ['meta_ads'] },
      { servico: 'crm_automacao', valor: 799.5 },
    ]
    expect(somaServicos(itens)).toBe(2300)
  })
})

describe('rotuloPlataformas', () => {
  it('uma plataforma → só o nome', () => {
    expect(rotuloPlataformas(['meta_ads'])).toBe('Meta Ads')
    expect(rotuloPlataformas(['google_ads'])).toBe('Google Ads')
  })

  it("ambas → 'Meta Ads e Google Ads'", () => {
    expect(rotuloPlataformas(['meta_ads', 'google_ads'])).toBe('Meta Ads e Google Ads')
  })

  it('undefined ou vazio → string vazia', () => {
    expect(rotuloPlataformas(undefined)).toBe('')
    expect(rotuloPlataformas([])).toBe('')
  })
})

describe('descricaoObjetoServicos', () => {
  it('gera 1 parágrafo pt-BR por serviço', () => {
    const itens: ServicoContratado[] = [
      { servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads', 'google_ads'] },
      { servico: 'landing_page', valor: 500 },
      { servico: 'crm_automacao', valor: 800 },
      { servico: 'estrategia', valor: 600 },
    ]
    const paragrafos = descricaoObjetoServicos(itens)
    expect(paragrafos).toHaveLength(4)
    expect(paragrafos[0]).toContain('tráfego pago')
    expect(paragrafos[0]).toContain('Meta Ads e Google Ads')
    expect(paragrafos[1]).toContain('landing page')
    expect(paragrafos[2]).toContain('CRM')
    expect(paragrafos[3]).toContain('estratégia')
  })

  it('tráfego pago com uma plataforma cita só ela', () => {
    const [p] = descricaoObjetoServicos([
      { servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads'] },
    ])
    expect(p).toContain('Meta Ads')
    expect(p).not.toContain('Google Ads')
  })
})

describe('rotuloServicoUi', () => {
  it('rótulos pt-BR com acento para a UI', () => {
    expect(rotuloServicoUi('trafego_pago')).toBe('Tráfego Pago')
    expect(rotuloServicoUi('landing_page')).toBe('Landing Page e Site')
    expect(rotuloServicoUi('crm_automacao')).toBe('CRM e Automação')
    expect(rotuloServicoUi('estrategia')).toBe('Estratégia e Estruturação')
  })
})
