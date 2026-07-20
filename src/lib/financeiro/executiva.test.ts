import { describe, expect, it } from 'vitest'

import {
  churnAcumulado,
  ltvMedio,
  rankingMotivos,
  taxaDeChurn,
  type ClienteVida,
} from './executiva'

// Fábrica de cliente com defaults neutros — cada teste sobrescreve só o que importa.
function cliente(over: Partial<ClienteVida> = {}): ClienteVida {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    status: 'ativo',
    inicio: '2025-01-01',
    dataEncerramento: null,
    motivoEncerramento: null,
    ticketMensal: null,
    ...over,
  }
}

describe('taxaDeChurn', () => {
  it('1 encerrado no mês sobre 10 ativos no início do mês = 10%', () => {
    const base = Array.from({ length: 9 }, () => cliente())
    const encerrado = cliente({
      status: 'encerrado',
      dataEncerramento: '2026-07-10',
    })
    const r = taxaDeChurn([...base, encerrado], '2026-07')
    expect(r.encerrados).toBe(1)
    expect(r.base).toBe(10)
    expect(r.percentual).toBe(10)
  })

  it('0 ativos no início do mês → percentual null (sem divisão por zero)', () => {
    // Único cliente entrou DENTRO do mês — não conta na base do início.
    const novato = cliente({ inicio: '2026-07-15' })
    const r = taxaDeChurn([novato], '2026-07')
    expect(r.base).toBe(0)
    expect(r.percentual).toBeNull()
  })

  it('encerrado SEM data_encerramento não conta como churn do mês', () => {
    const semData = cliente({ status: 'encerrado', dataEncerramento: null })
    const r = taxaDeChurn([cliente(), semData], '2026-07')
    expect(r.encerrados).toBe(0)
    expect(r.percentual).toBe(0)
  })

  it('encerrado em OUTRO mês não conta no mês pedido', () => {
    const foraDoMes = cliente({ status: 'encerrado', dataEncerramento: '2026-06-30' })
    const r = taxaDeChurn([cliente(), foraDoMes], '2026-07')
    expect(r.encerrados).toBe(0)
  })

  it('cliente já encerrado antes do mês sai da base do início', () => {
    const antigo = cliente({ status: 'encerrado', dataEncerramento: '2026-01-15' })
    const r = taxaDeChurn([cliente(), antigo], '2026-07')
    expect(r.base).toBe(1)
  })

  it('nenhum encerramento → churn 0%', () => {
    const r = taxaDeChurn([cliente(), cliente()], '2026-07')
    expect(r.percentual).toBe(0)
  })
})

describe('churnAcumulado', () => {
  it('janela de 3 meses soma encerrados sobre ativos no início da janela', () => {
    // Janela terminando em 2026-07 com 3 meses = mai/jun/jul.
    const clientes = [
      ...Array.from({ length: 8 }, () => cliente()),
      cliente({ status: 'encerrado', dataEncerramento: '2026-05-10' }),
      cliente({ status: 'encerrado', dataEncerramento: '2026-07-01' }),
    ]
    const r = churnAcumulado(clientes, '2026-07', 3)
    expect(r.encerrados).toBe(2)
    expect(r.base).toBe(10)
    expect(r.percentual).toBe(20)
  })

  it('janela de 6 meses inclui encerramento de janeiro ao terminar em junho', () => {
    const clientes = [
      cliente(),
      cliente({ status: 'encerrado', dataEncerramento: '2026-01-20' }),
    ]
    const r = churnAcumulado(clientes, '2026-06', 6)
    expect(r.encerrados).toBe(1)
    expect(r.base).toBe(2)
    expect(r.percentual).toBe(50)
  })

  it('janela sem base → percentual null', () => {
    const clientes = [cliente({ inicio: '2026-07-01' })]
    const r = churnAcumulado(clientes, '2026-07', 3)
    expect(r.base).toBe(0)
    expect(r.percentual).toBeNull()
  })

  it('encerramento ANTES da janela não conta como churn (e sai da base)', () => {
    const clientes = [
      cliente(),
      cliente({ status: 'encerrado', dataEncerramento: '2025-12-31' }),
    ]
    const r = churnAcumulado(clientes, '2026-07', 3)
    expect(r.encerrados).toBe(0)
    expect(r.base).toBe(1)
  })
})

describe('ltvMedio', () => {
  it('encerrado conta vida do início até a data de encerramento', () => {
    // 60 dias / 30 = 2 meses; ticket 1000 → LTV 2000.
    const c = cliente({
      status: 'encerrado',
      inicio: '2026-01-01',
      dataEncerramento: '2026-03-02',
      ticketMensal: 1000,
    })
    const r = ltvMedio([c], '2026-07-19')
    expect(r).not.toBeNull()
    expect(r!.vidaMediaMeses).toBe(2)
    expect(r!.ticketMedio).toBe(1000)
    expect(r!.valor).toBe(2000)
  })

  it('cliente ATIVO conta vida até hoje', () => {
    // 2026-01-01 → 2026-04-01 = 90 dias = 3 meses.
    const c = cliente({ inicio: '2026-01-01', ticketMensal: 500 })
    const r = ltvMedio([c], '2026-04-01')
    expect(r!.vidaMediaMeses).toBe(3)
    expect(r!.valor).toBe(1500)
  })

  it('vida menor que 1 mês vale o mínimo de 1 mês', () => {
    const c = cliente({ inicio: '2026-07-10', ticketMensal: 800 })
    const r = ltvMedio([c], '2026-07-19')
    expect(r!.vidaMediaMeses).toBe(1)
    expect(r!.valor).toBe(800)
  })

  it('média entre clientes: vida média × ticket médio', () => {
    const a = cliente({ inicio: '2026-01-01', ticketMensal: 1000 }) // 90d = 3 meses
    const b = cliente({
      status: 'encerrado',
      inicio: '2026-03-02',
      dataEncerramento: '2026-04-01',
      ticketMensal: 2000,
    }) // 30d = 1 mês
    const r = ltvMedio([a, b], '2026-04-01')
    expect(r!.vidaMediaMeses).toBe(2)
    expect(r!.ticketMedio).toBe(1500)
    expect(r!.valor).toBe(3000)
  })

  it('sem cliente com início conhecido → null', () => {
    const r = ltvMedio([cliente({ inicio: null, ticketMensal: 100 })], '2026-07-19')
    expect(r).toBeNull()
  })

  it('sem nenhum ticket conhecido → null', () => {
    const r = ltvMedio([cliente({ ticketMensal: null })], '2026-07-19')
    expect(r).toBeNull()
  })
})

describe('rankingMotivos', () => {
  it('agrupa por motivo com trim e case-insensitive, ordena por contagem desc', () => {
    const clientes = [
      cliente({ status: 'encerrado', motivoEncerramento: 'Preço' }),
      cliente({ status: 'encerrado', motivoEncerramento: ' preço ' }),
      cliente({ status: 'encerrado', motivoEncerramento: 'PREÇO' }),
      cliente({ status: 'encerrado', motivoEncerramento: 'Sem resultado' }),
    ]
    const r = rankingMotivos(clientes)
    expect(r).toEqual([
      { motivo: 'Preço', quantidade: 3 },
      { motivo: 'Sem resultado', quantidade: 1 },
    ])
  })

  it('ignora motivos nulos ou vazios', () => {
    const clientes = [
      cliente({ status: 'encerrado', motivoEncerramento: null }),
      cliente({ status: 'encerrado', motivoEncerramento: '   ' }),
    ]
    expect(rankingMotivos(clientes)).toEqual([])
  })

  it('nenhum encerrado → ranking vazio', () => {
    expect(rankingMotivos([cliente(), cliente()])).toEqual([])
  })
})
