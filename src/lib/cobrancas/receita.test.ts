import { describe, expect, it } from 'vitest'

import { marcadorCobranca, montarTransacaoDaCobranca } from './receita'

const cobranca = {
  id: 'abc-123',
  clienteId: 'cli-1',
  valor: '1500.00',
  competencia: '2026-07',
}

describe('marcadorCobranca', () => {
  it('gera o marcador de dedup no formato [cobranca:<id>]', () => {
    expect(marcadorCobranca('abc-123')).toBe('[cobranca:abc-123]')
  })
})

describe('montarTransacaoDaCobranca', () => {
  it('monta receita de mensalidade paga com o marcador nas notas', () => {
    const t = montarTransacaoDaCobranca(cobranca, { forma: 'asaas', dataPagamento: '2026-07-16' })
    expect(t.tipo).toBe('receita')
    expect(t.categoria).toBe('mensalidade')
    expect(t.status).toBe('pago')
    expect(t.recorrencia).toBe('avulsa')
    expect(t.clienteId).toBe('cli-1')
    expect(t.valor).toBe('1500.00')
    expect(t.data).toBe('2026-07-16')
    expect(t.descricao).toContain('2026-07')
    expect(t.notas).toContain('[cobranca:abc-123]')
  })

  it('PIX manual grava formaPagamento pix; Asaas deixa null (pode ser pix ou boleto)', () => {
    const manual = montarTransacaoDaCobranca(cobranca, { forma: 'pix_manual', dataPagamento: '2026-07-16' })
    const asaas = montarTransacaoDaCobranca(cobranca, { forma: 'asaas', dataPagamento: '2026-07-16' })
    expect(manual.formaPagamento).toBe('pix')
    expect(asaas.formaPagamento).toBeNull()
  })
})
