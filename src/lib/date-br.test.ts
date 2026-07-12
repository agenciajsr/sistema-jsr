import { describe, it, expect } from 'vitest'

import { hojeBrasilia, dataMenosDias } from './date-br'

describe('hojeBrasilia', () => {
  it('retorna string no formato YYYY-MM-DD', () => {
    const hoje = hojeBrasilia()
    expect(hoje).toHaveLength(10)
    expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('dataMenosDias', () => {
  it('dataMenosDias(0) === hojeBrasilia()', () => {
    expect(dataMenosDias(0)).toBe(hojeBrasilia())
  })

  it('subtrai 30 dias corretamente (sem drift de DST)', () => {
    expect(dataMenosDias(30, '2026-07-12')).toBe('2026-06-12')
  })

  it('atravessa a virada de mês', () => {
    expect(dataMenosDias(1, '2026-03-01')).toBe('2026-02-28')
  })

  it('resultado sempre no formato YYYY-MM-DD', () => {
    expect(dataMenosDias(7, '2026-07-12')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
