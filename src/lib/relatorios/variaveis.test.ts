import { describe, it, expect } from 'vitest'

import { interpolarVariaveis, CATALOGO_VARIAVEIS } from './variaveis'

describe('interpolarVariaveis', () => {
  it('substitui variáveis com formatação pt-BR', () => {
    const texto = interpolarVariaveis(
      'Investimento: {{investimento}} | Leads: {{leads}} | CTR: {{ctr}} | ROAS: {{roas}}',
      { investimento: 1234.56, leads: 42, ctr: 1.5, roas: 2 },
    )
    expect(texto).toContain('R$ 1.234,56')
    expect(texto).toContain('Leads: 42')
    expect(texto).toContain('1,5%')
    expect(texto).toContain('2,00x')
  })

  it('substitui variáveis de texto (cliente, date_range)', () => {
    const texto = interpolarVariaveis('{{cliente}} — {{date_range}}', {
      cliente: 'Loja X',
      date_range: '01/07 a 07/07',
    })
    expect(texto).toBe('Loja X — 01/07 a 07/07')
  })

  it('variável desconhecida ou sem valor vira "—" (nunca lança)', () => {
    expect(interpolarVariaveis('{{nao_existe}} / {{cpl}}', { cpl: null })).toBe('— / —')
  })

  it('aceita alias <MAIÚSCULA> (<DATA> ≡ {{date_range}})', () => {
    const texto = interpolarVariaveis('Período: <DATA> | <INVESTIMENTO>', {
      date_range: '01/07 a 07/07',
      investimento: 100,
    })
    expect(texto).toBe('Período: 01/07 a 07/07 | R$ 100,00')
  })

  it('tolera espaços dentro das chaves', () => {
    expect(interpolarVariaveis('{{ leads }}', { leads: 3 })).toBe('3')
  })
})

describe('CATALOGO_VARIAVEIS', () => {
  it('tem chaves únicas e todas as categorias esperadas', () => {
    const chaves = CATALOGO_VARIAVEIS.map((v) => v.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
    const categorias = new Set(CATALOGO_VARIAVEIS.map((v) => v.categoria))
    for (const cat of ['gerais', 'investimento', 'cliques', 'leads', 'conversas', 'vendas', 'pagina']) {
      expect(categorias.has(cat as never)).toBe(true)
    }
  })
})
