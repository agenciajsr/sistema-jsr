import { describe, expect, it } from 'vitest'
import { selecionarContratoAtual, type ContratoRow } from '@/lib/contratos/current'

// CLI-04: derivação do contrato atual — implementado em 01-05-PLAN.md
describe('selecionarContratoAtual', () => {
  it('retorna o contrato com dataInicio mais recente, mesmo fora de ordem', () => {
    const contratos: ContratoRow[] = [
      {
        id: '1',
        clienteId: 'abc-123',
        dataInicio: '2025-01-01',
        dataVencimento: '2025-12-31',
        valorMensal: '1000',
      },
      {
        id: '2',
        clienteId: 'abc-123',
        dataInicio: '2026-01-01',
        dataVencimento: '2026-12-31',
        valorMensal: '1500',
      },
      {
        id: '3',
        clienteId: 'abc-123',
        dataInicio: '2025-06-01',
        dataVencimento: '2026-05-31',
        valorMensal: '1200',
      },
    ]

    const atual = selecionarContratoAtual(contratos)

    expect(atual?.id).toBe('2')
    expect(atual?.dataInicio).toBe('2026-01-01')
  })

  it('retorna o único contrato quando há apenas um', () => {
    const contratos: ContratoRow[] = [
      {
        id: '1',
        clienteId: 'abc-123',
        dataInicio: '2025-01-01',
        dataVencimento: '2025-12-31',
        valorMensal: '1000',
      },
    ]

    const atual = selecionarContratoAtual(contratos)

    expect(atual?.id).toBe('1')
  })

  it('retorna null quando o array está vazio', () => {
    const atual = selecionarContratoAtual([])

    expect(atual).toBeNull()
  })

  it('retorna um dos contratos sem lançar erro quando há empate na dataInicio', () => {
    const contratos: ContratoRow[] = [
      {
        id: '1',
        clienteId: 'abc-123',
        dataInicio: '2026-01-01',
        dataVencimento: '2026-12-31',
        valorMensal: '1000',
      },
      {
        id: '2',
        clienteId: 'abc-123',
        dataInicio: '2026-01-01',
        dataVencimento: '2026-11-30',
        valorMensal: '1500',
      },
    ]

    expect(() => selecionarContratoAtual(contratos)).not.toThrow()
    const atual = selecionarContratoAtual(contratos)
    expect(['1', '2']).toContain(atual?.id)
  })
})
