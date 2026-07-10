import { describe, expect, it } from 'vitest'
import { construirRegistroRenovacao } from '@/lib/contratos/renovacao'

// CLI-03: renovação de contrato sempre cria novo registro (D-06) — implementado em 01-05-PLAN.md
describe('construirRegistroRenovacao', () => {
  it('mapeia os dados de renovação para um registro de contrato novo', () => {
    const resultado = construirRegistroRenovacao('abc-123', {
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: 1500,
    })

    expect(resultado).toEqual({
      clienteId: 'abc-123',
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: '1500',
    })
  })

  it('nunca inclui a chave id no registro retornado', () => {
    const resultado = construirRegistroRenovacao('abc-123', {
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: 1500,
    })

    expect(resultado).not.toHaveProperty('id')
  })

  it('produz registros independentes ao chamar duas vezes para o mesmo cliente', () => {
    const primeiraRenovacao = construirRegistroRenovacao('abc-123', {
      dataInicio: '2025-01-01',
      dataVencimento: '2025-12-31',
      valorMensal: 1000,
    })

    const segundaRenovacao = construirRegistroRenovacao('abc-123', {
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: 1500,
    })

    expect(primeiraRenovacao).not.toBe(segundaRenovacao)
    expect(primeiraRenovacao).toEqual({
      clienteId: 'abc-123',
      dataInicio: '2025-01-01',
      dataVencimento: '2025-12-31',
      valorMensal: '1000',
    })
    expect(segundaRenovacao).toEqual({
      clienteId: 'abc-123',
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: '1500',
    })
  })
})
