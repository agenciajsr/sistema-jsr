import { describe, expect, it } from 'vitest'

import { detectarNovasOportunidades, rotuloNovidade } from './novidades'

// Detecção de "lead novo" entre renders da /crm (quick 260717-pvr): compara os
// ids do render anterior com os atuais. A PRIMEIRA carga nunca toasta — o
// chamador passa null enquanto ainda não tem um render anterior.

const op = (id: string, titulo = `Negócio ${id}`, contatoNome: string | null = null) => ({
  id,
  titulo,
  contatoNome,
})

describe('detectarNovasOportunidades', () => {
  it('retorna [] quando todos os ids atuais já existiam', () => {
    const anteriores = new Set(['a', 'b', 'c'])
    expect(detectarNovasOportunidades(anteriores, [op('a'), op('b'), op('c')])).toEqual([])
  })

  it('retorna só as oportunidades cujo id NÃO estava em idsAnteriores', () => {
    const anteriores = new Set(['a', 'b'])
    const novo = op('c', 'Tráfego pago — Maria', 'Maria')
    expect(detectarNovasOportunidades(anteriores, [op('a'), novo, op('b')])).toEqual([novo])
  })

  it('primeira carga (idsAnteriores null) retorna [] — nunca toastar a carga inicial', () => {
    expect(detectarNovasOportunidades(null, [op('a'), op('b')])).toEqual([])
  })

  it('remoção de ids (lead ganho/perdido some do board) não gera novidade', () => {
    const anteriores = new Set(['a', 'b', 'c'])
    expect(detectarNovasOportunidades(anteriores, [op('a')])).toEqual([])
  })

  it('Set anterior VAZIO (board estava vazio) detecta os que chegaram', () => {
    const novo = op('x', 'CRM — João', 'João')
    expect(detectarNovasOportunidades(new Set(), [novo])).toEqual([novo])
  })
})

describe('rotuloNovidade', () => {
  it('usa o contatoNome quando existir', () => {
    expect(rotuloNovidade(op('a', 'Tráfego pago — Maria', 'Maria'))).toBe('Maria')
  })

  it('cai para o titulo quando contatoNome é null ou vazio', () => {
    expect(rotuloNovidade(op('a', 'Tráfego pago — Lead', null))).toBe('Tráfego pago — Lead')
    expect(rotuloNovidade(op('a', 'Tráfego pago — Lead', '  '))).toBe('Tráfego pago — Lead')
  })
})
