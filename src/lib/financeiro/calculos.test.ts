import { describe, it, expect } from 'vitest'

import {
  calcularVariacaoPercentual,
  calcularDespesasVsFaturamento,
  contarRenovados,
  calcularTaxaRenovacao,
  calcularLucroPorCliente,
  calcularDependencia,
  periodoMesAnterior,
  progressoDoMes,
} from './calculos'

describe('calcularVariacaoPercentual', () => {
  it('calcula alta percentual', () => {
    expect(calcularVariacaoPercentual(150, 100)).toBe(50)
  })

  it('calcula queda percentual', () => {
    expect(calcularVariacaoPercentual(50, 100)).toBe(-50)
  })

  it('retorna null quando o anterior e zero (nunca divide por zero)', () => {
    expect(calcularVariacaoPercentual(100, 0)).toBeNull()
  })

  it('retorna null quando ambos sao zero', () => {
    expect(calcularVariacaoPercentual(0, 0)).toBeNull()
  })

  it('retorna -100 quando o atual zerou', () => {
    expect(calcularVariacaoPercentual(0, 100)).toBe(-100)
  })
})

describe('calcularDespesasVsFaturamento', () => {
  it('classifica como saudavel abaixo de 60%', () => {
    expect(calcularDespesasVsFaturamento(3000, 10000)).toEqual({
      percentual: 30,
      faixa: 'saudavel',
      despesa: 3000,
      receita: 10000,
    })
  })

  it('classifica como atencao entre 60% e 80%', () => {
    expect(calcularDespesasVsFaturamento(7000, 10000).faixa).toBe('atencao')
  })

  it('trata a borda de 60% exato como atencao', () => {
    const r = calcularDespesasVsFaturamento(6000, 10000)
    expect(r.percentual).toBe(60)
    expect(r.faixa).toBe('atencao')
  })

  it('trata a borda de 80% exato como critico', () => {
    const r = calcularDespesasVsFaturamento(8000, 10000)
    expect(r.percentual).toBe(80)
    expect(r.faixa).toBe('critico')
  })

  it('classifica como critico acima de 80%', () => {
    expect(calcularDespesasVsFaturamento(9500, 10000).faixa).toBe('critico')
  })

  it('retorna percentual e faixa null quando a receita e zero', () => {
    expect(calcularDespesasVsFaturamento(5000, 0)).toEqual({
      percentual: null,
      faixa: null,
      despesa: 5000,
      receita: 0,
    })
  })
})

describe('contarRenovados', () => {
  it('conta contrato posterior do mesmo cliente como renovacao', () => {
    const vencidos = [
      { clienteId: 'a', dataVencimento: '2026-07-31' },
      { clienteId: 'b', dataVencimento: '2026-07-15' },
    ]
    const contratos = [{ clienteId: 'a', dataInicio: '2026-08-01' }]
    expect(contarRenovados(vencidos, contratos)).toBe(1)
  })

  it('nao conta contrato posterior de OUTRO cliente', () => {
    const vencidos = [{ clienteId: 'a', dataVencimento: '2026-07-31' }]
    const contratos = [{ clienteId: 'z', dataInicio: '2026-08-01' }]
    expect(contarRenovados(vencidos, contratos)).toBe(0)
  })

  it('nao conta contrato do mesmo cliente que nao e posterior ao vencimento', () => {
    const vencidos = [{ clienteId: 'a', dataVencimento: '2026-07-31' }]
    const contratos = [{ clienteId: 'a', dataInicio: '2026-07-31' }]
    expect(contarRenovados(vencidos, contratos)).toBe(0)
  })

  it('retorna 0 quando nao ha vencidos', () => {
    expect(contarRenovados([], [{ clienteId: 'a', dataInicio: '2026-08-01' }])).toBe(0)
  })
})

describe('calcularTaxaRenovacao', () => {
  it('calcula o percentual de renovacao', () => {
    expect(calcularTaxaRenovacao(3, 4)).toEqual({ renovados: 3, total: 4, percentual: 75 })
  })

  it('retorna 100% quando nenhum contrato vencia no periodo (0/0)', () => {
    expect(calcularTaxaRenovacao(0, 0)).toEqual({ renovados: 0, total: 0, percentual: 100 })
  })

  it('retorna 0% quando nada foi renovado', () => {
    expect(calcularTaxaRenovacao(0, 2).percentual).toBe(0)
  })
})

describe('calcularLucroPorCliente', () => {
  it('divide o lucro pela quantidade de clientes', () => {
    expect(calcularLucroPorCliente(10000, 4)).toBe(2500)
  })

  it('retorna 0 quando nao ha clientes', () => {
    expect(calcularLucroPorCliente(10000, 0)).toBe(0)
  })

  it('preserva prejuizo', () => {
    expect(calcularLucroPorCliente(-1000, 2)).toBe(-500)
  })
})

describe('calcularDependencia', () => {
  it('calcula os percentuais top5/top10 e limita a lista a 10', () => {
    const linhas = Array.from({ length: 12 }, (_, i) => ({ nome: `c${i}`, valor: 100 }))
    const r = calcularDependencia(linhas)
    expect(r.mrrTotal).toBe(1200)
    expect(r.percentTop5).toBe(41.67)
    expect(r.percentTop10).toBe(83.33)
    expect(r.topClientes).toHaveLength(10)
  })

  it('retorna estrutura zerada para lista vazia (sem divisao por zero)', () => {
    expect(calcularDependencia([])).toEqual({
      mrrTotal: 0,
      topClientes: [],
      percentTop5: 0,
      percentTop10: 0,
    })
  })

  it('trata menos de 5 clientes como 100% de concentracao', () => {
    const r = calcularDependencia([
      { nome: 'medio', valor: 300 },
      { nome: 'grande', valor: 600 },
      { nome: 'pequeno', valor: 100 },
    ])
    expect(r.mrrTotal).toBe(1000)
    expect(r.percentTop5).toBe(100)
    expect(r.percentTop10).toBe(100)
    expect(r.topClientes[0]).toEqual({ nome: 'grande', valor: 600, percentual: 60 })
  })

  it('ordena por valor decrescente', () => {
    const r = calcularDependencia([
      { nome: 'a', valor: 100 },
      { nome: 'b', valor: 900 },
      { nome: 'c', valor: 500 },
    ])
    expect(r.topClientes.map((c) => c.nome)).toEqual(['b', 'c', 'a'])
  })
})

describe('periodoMesAnterior', () => {
  it('retorna o mes anterior dentro do mesmo ano', () => {
    expect(periodoMesAnterior(7, 2026)).toEqual({
      mes: 6,
      ano: 2026,
      primeiroDia: '2026-06-01',
      ultimoDia: '2026-06-30',
    })
  })

  it('vira o ano corretamente em janeiro', () => {
    expect(periodoMesAnterior(1, 2026)).toEqual({
      mes: 12,
      ano: 2025,
      primeiroDia: '2025-12-01',
      ultimoDia: '2025-12-31',
    })
  })

  it('respeita ano bissexto', () => {
    expect(periodoMesAnterior(3, 2024).ultimoDia).toBe('2024-02-29')
  })
})

describe('progressoDoMes', () => {
  it('calcula dia, dias do mes e percentual', () => {
    expect(progressoDoMes('2026-07-14')).toEqual({ dia: 14, diasNoMes: 31, percentual: 45 })
  })

  it('retorna 100% no ultimo dia do mes', () => {
    expect(progressoDoMes('2026-02-28')).toEqual({ dia: 28, diasNoMes: 28, percentual: 100 })
  })
})
