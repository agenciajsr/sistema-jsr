import { describe, it, expect } from 'vitest'

import {
  calcularLtDias,
  montarLinhas,
  filtrarClientes,
  contarPorStatus,
  type ClienteLinha,
} from './agregar'

describe('calcularLtDias', () => {
  it('usa a data do contrato mais antigo quando existe', () => {
    expect(calcularLtDias('2026-06-14', '2026-07-01T00:00:00.000Z', '2026-07-14')).toBe(30)
  })

  it('cai para o createdAt quando nao ha contrato', () => {
    expect(calcularLtDias(null, '2026-07-04T00:00:00.000Z', '2026-07-14')).toBe(10)
  })

  it('devolve 0 quando o relacionamento comeca hoje', () => {
    expect(calcularLtDias('2026-07-14', '2026-07-14T00:00:00.000Z', '2026-07-14')).toBe(0)
  })

  it('nunca devolve negativo para data futura', () => {
    expect(calcularLtDias('2026-07-15', '2026-07-01T00:00:00.000Z', '2026-07-14')).toBe(0)
  })
})

// Base minima reutilizada nos testes de merge.
const base = [
  {
    id: 'c1',
    nome: 'Acme',
    status: 'ativo' as const,
    createdAt: new Date('2026-07-04T00:00:00.000Z'),
    responsavelNome: 'Ana',
  },
  {
    id: 'c2',
    nome: 'Farmacia Sol',
    status: 'pausado' as const,
    createdAt: new Date('2026-07-04T00:00:00.000Z'),
    responsavelNome: null,
  },
]

describe('montarLinhas', () => {
  it('preenche todos os campos quando o cliente esta em todos os agregados', () => {
    const linhas = montarLinhas(
      [base[0]],
      [{ clienteId: 'c1', valor: '1500.00' }],
      [{ clienteId: 'c1', inicio: '2026-06-14' }],
      [{ clienteId: 'c1', total: '9000.00' }],
      [{ clienteId: 'c1', total: 2 }],
      [{ clienteId: 'c1', total: '750.50' }],
      '2026-07-14'
    )

    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toEqual({
      id: 'c1',
      nome: 'Acme',
      status: 'ativo',
      responsavelNome: 'Ana',
      mensalidade: 1500,
      ltDias: 30,
      ltv: 9000,
      alertasAbertos: 2,
      investimento30d: 750.5,
    })
  })

  it('zera (nunca undefined/NaN) quando o cliente esta ausente dos agregados', () => {
    const linhas = montarLinhas([base[0]], [], [], [], [], [], '2026-07-14')

    expect(linhas[0].mensalidade).toBe(0)
    expect(linhas[0].ltv).toBe(0)
    expect(linhas[0].alertasAbertos).toBe(0)
    expect(linhas[0].investimento30d).toBe(0)
    // sem contrato => LT ancora no createdAt
    expect(linhas[0].ltDias).toBe(10)
  })

  it('ignora agregado orfao (clienteId fora da base), sem criar linha fantasma', () => {
    const linhas = montarLinhas(
      [base[0]],
      [
        { clienteId: 'c1', valor: '1000.00' },
        { clienteId: 'fantasma', valor: '9999.00' },
      ],
      [],
      [],
      [],
      [],
      '2026-07-14'
    )

    expect(linhas).toHaveLength(1)
    expect(linhas[0].id).toBe('c1')
    expect(linhas[0].mensalidade).toBe(1000)
  })

  it('mantem responsavelNome null quando nao ha gestor', () => {
    const linhas = montarLinhas([base[1]], [], [], [], [], [], '2026-07-14')
    expect(linhas[0].responsavelNome).toBeNull()
  })

  it('converte numeric string do postgres em number', () => {
    const linhas = montarLinhas(
      [base[0]],
      [{ clienteId: 'c1', valor: '1500.00' }],
      [],
      [],
      [],
      [],
      '2026-07-14'
    )

    expect(linhas[0].mensalidade).toBe(1500)
    expect(typeof linhas[0].mensalidade).toBe('number')
  })
})

const linhas: ClienteLinha[] = [
  {
    id: 'c1',
    nome: 'Acme',
    status: 'ativo',
    responsavelNome: 'Ana',
    mensalidade: 1500,
    ltDias: 30,
    ltv: 9000,
    alertasAbertos: 0,
    investimento30d: 0,
  },
  {
    id: 'c2',
    nome: 'Farmacia Sol',
    status: 'pausado',
    responsavelNome: null,
    mensalidade: 0,
    ltDias: 10,
    ltv: 0,
    alertasAbertos: 1,
    investimento30d: 0,
  },
  {
    id: 'c3',
    nome: 'Zebra Motors',
    status: 'ativo',
    responsavelNome: 'Bia',
    mensalidade: 2000,
    ltDias: 5,
    ltv: 2000,
    alertasAbertos: 0,
    investimento30d: 100,
  },
]

describe('filtrarClientes', () => {
  it('filtra pela aba de status e devolve tudo na aba todos', () => {
    expect(filtrarClientes(linhas, { busca: '', aba: 'ativo' }).map((l) => l.id)).toEqual(['c1', 'c3'])
    expect(filtrarClientes(linhas, { busca: '', aba: 'todos' })).toHaveLength(3)
  })

  it('busca por substring case-insensitive', () => {
    const r = filtrarClientes(linhas, { busca: 'ac', aba: 'todos' })
    expect(r.map((l) => l.nome)).toEqual(['Acme', 'Farmacia Sol'])
  })

  it('ignora espacos nas pontas e busca vazia nao filtra nome', () => {
    expect(filtrarClientes(linhas, { busca: '  acme  ', aba: 'todos' })).toHaveLength(1)
    expect(filtrarClientes(linhas, { busca: '   ', aba: 'todos' })).toHaveLength(3)
  })

  it('combina busca e aba com AND', () => {
    const r = filtrarClientes(linhas, { busca: 'a', aba: 'ativo' })
    expect(r.map((l) => l.id)).toEqual(['c1'])
  })
})

describe('contarPorStatus', () => {
  it('conta por status e total, com todas as chaves presentes em 0', () => {
    const c = contarPorStatus(linhas)

    expect(c.ativo).toBe(2)
    expect(c.pausado).toBe(1)
    expect(c.todos).toBe(3)
    expect(c.aguardando_inicio).toBe(0)
    expect(c.em_aviso).toBe(0)
    expect(c.encerrado).toBe(0)
  })
})
