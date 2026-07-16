import { describe, it, expect } from 'vitest'

import {
  STATUS_FLUXO,
  rotuloStatusFluxo,
  badgeStatusFluxo,
  montarDadosContrato,
  gerarToken,
  type StatusFluxo,
} from './fluxo'

// Fluxo do contrato (Fase 4 Parte 1) — módulo PURO (pode importar node:crypto,
// mas zero db/auth/react). Datas são strings 'YYYY-MM-DD' sem passar por fuso.

describe('STATUS_FLUXO', () => {
  const statuses: StatusFluxo[] = [
    'aguardando_dados',
    'dados_recebidos',
    'aguardando_assinatura',
    'assinado',
  ]

  it('tem rótulo em português e classes de badge para cada status', () => {
    for (const s of statuses) {
      expect(STATUS_FLUXO[s].rotulo.length).toBeGreaterThan(0)
      expect(STATUS_FLUXO[s].badge.length).toBeGreaterThan(0)
    }
  })

  it('rótulos esperados', () => {
    expect(STATUS_FLUXO.aguardando_dados.rotulo).toBe('Aguardando dados')
    expect(STATUS_FLUXO.dados_recebidos.rotulo).toBe('Dados recebidos')
    expect(STATUS_FLUXO.aguardando_assinatura.rotulo).toBe('Aguardando assinatura')
    expect(STATUS_FLUXO.assinado.rotulo).toBe('Assinado')
  })

  it('badges têm variante dark: (memória dark-mode)', () => {
    for (const s of statuses) {
      expect(STATUS_FLUXO[s].badge).toContain('dark:')
    }
  })

  it('rotuloStatusFluxo cai em "Manual" para status nulo/desconhecido (contrato legado)', () => {
    expect(rotuloStatusFluxo(null)).toBe('Manual')
    expect(rotuloStatusFluxo(undefined)).toBe('Manual')
    expect(rotuloStatusFluxo('qualquer_coisa')).toBe('Manual')
    expect(rotuloStatusFluxo('assinado')).toBe('Assinado')
  })

  it('badgeStatusFluxo devolve classe neutra para legado', () => {
    expect(badgeStatusFluxo(null).length).toBeGreaterThan(0)
    expect(badgeStatusFluxo('dados_recebidos')).toBe(STATUS_FLUXO.dados_recebidos.badge)
  })
})

describe('montarDadosContrato', () => {
  it('dataInicio = hoje e dataVencimento = hoje + 3 meses', () => {
    const r = montarDadosContrato({ duracaoMeses: 3, mensalidade: 1500, hoje: '2026-07-16' })
    expect(r.dataInicio).toBe('2026-07-16')
    expect(r.dataVencimento).toBe('2026-10-16')
  })

  it('hoje + 6 meses cruza o ano', () => {
    const r = montarDadosContrato({ duracaoMeses: 6, mensalidade: 2000, hoje: '2026-07-16' })
    expect(r.dataVencimento).toBe('2027-01-16')
  })

  it('grampeia o fim do mês (31/ago + 6 → 28/fev)', () => {
    const r = montarDadosContrato({ duracaoMeses: 6, mensalidade: 900, hoje: '2026-08-31' })
    expect(r.dataVencimento).toBe('2027-02-28')
  })

  it('valorMensal vira string com 2 casas (numeric do Postgres)', () => {
    const r = montarDadosContrato({ duracaoMeses: 3, mensalidade: 1234.5, hoje: '2026-07-16' })
    expect(r.valorMensal).toBe('1234.50')
  })
})

describe('gerarToken', () => {
  it('retorna string com pelo menos 32 caracteres', () => {
    expect(gerarToken().length).toBeGreaterThanOrEqual(32)
  })

  it('é imprevisível (duas chamadas nunca coincidem)', () => {
    expect(gerarToken()).not.toBe(gerarToken())
  })

  it('é seguro para URL (base64url, sem / + =)', () => {
    expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
