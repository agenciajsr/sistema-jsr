import { describe, expect, it } from 'vitest'

import { filtrarAReceber, labelMesPtBr } from './a-receber'

type Conta = { id: string; data: string; status: string }

const conta = (id: string, data: string, status: string): Conta => ({ id, data, status })

describe('filtrarAReceber', () => {
  const hoje = '2026-07-17'

  it('mantem vencidas, pendentes ate hoje e pendentes ate hoje+30; corta alem de 30 dias', () => {
    const contas = [
      conta('vencida-antiga', '2026-05-01', 'vencido'),
      conta('pendente-passada', '2026-07-10', 'pendente'),
      conta('pendente-hoje', '2026-07-17', 'pendente'),
      conta('pendente-30d', '2026-08-16', 'pendente'),
      conta('pendente-longe', '2026-09-01', 'pendente'),
    ]
    const resultado = filtrarAReceber(contas, hoje, false)
    expect(resultado.map((c) => c.id)).toEqual([
      'vencida-antiga',
      'pendente-passada',
      'pendente-hoje',
      'pendente-30d',
    ])
  })

  it('data exatamente hoje+30 entra no filtro', () => {
    const resultado = filtrarAReceber([conta('a', '2026-08-16', 'pendente')], hoje, false)
    expect(resultado).toHaveLength(1)
  })

  it('data hoje+31 fica fora do filtro', () => {
    const resultado = filtrarAReceber([conta('a', '2026-08-17', 'pendente')], hoje, false)
    expect(resultado).toHaveLength(0)
  })

  it('toda conta vencida entra mesmo com data futura distante', () => {
    const resultado = filtrarAReceber([conta('a', '2027-01-10', 'vencido')], hoje, false)
    expect(resultado).toHaveLength(1)
  })

  it('mostrarTodas=true devolve tudo, na mesma ordem', () => {
    const contas = [
      conta('a', '2026-07-01', 'pendente'),
      conta('b', '2026-12-01', 'pendente'),
      conta('c', '2027-03-01', 'pendente'),
    ]
    const resultado = filtrarAReceber(contas, hoje, true)
    expect(resultado.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('virada de ano: hoje=2026-12-15 inclui 2027-01-10', () => {
    const resultado = filtrarAReceber([conta('a', '2027-01-10', 'pendente')], '2026-12-15', false)
    expect(resultado).toHaveLength(1)
  })

  it('virada de ano: hoje=2026-12-15 corta 2027-01-15 (hoje+31)', () => {
    const resultado = filtrarAReceber([conta('a', '2027-01-15', 'pendente')], '2026-12-15', false)
    expect(resultado).toHaveLength(0)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(filtrarAReceber([], hoje, false)).toEqual([])
  })

  it('preserva a ordenacao por data recebida', () => {
    const contas = [
      conta('a', '2026-07-01', 'vencido'),
      conta('b', '2026-07-18', 'pendente'),
      conta('c', '2026-07-20', 'pendente'),
    ]
    const resultado = filtrarAReceber(contas, hoje, false)
    expect(resultado.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('labelMesPtBr', () => {
  it('formata 2026-08 como ago/2026', () => {
    expect(labelMesPtBr('2026-08')).toBe('ago/2026')
  })

  it('formata todos os meses com abreviacao pt-BR', () => {
    expect(labelMesPtBr('2026-01')).toBe('jan/2026')
    expect(labelMesPtBr('2026-02')).toBe('fev/2026')
    expect(labelMesPtBr('2026-03')).toBe('mar/2026')
    expect(labelMesPtBr('2026-04')).toBe('abr/2026')
    expect(labelMesPtBr('2026-05')).toBe('mai/2026')
    expect(labelMesPtBr('2026-06')).toBe('jun/2026')
    expect(labelMesPtBr('2026-07')).toBe('jul/2026')
    expect(labelMesPtBr('2026-09')).toBe('set/2026')
    expect(labelMesPtBr('2026-10')).toBe('out/2026')
    expect(labelMesPtBr('2026-11')).toBe('nov/2026')
    expect(labelMesPtBr('2027-12')).toBe('dez/2027')
  })

  it('mes invalido devolve a propria string (fallback defensivo)', () => {
    expect(labelMesPtBr('2026-13')).toBe('2026-13')
  })
})
