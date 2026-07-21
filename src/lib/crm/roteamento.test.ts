import { describe, expect, it } from 'vitest'

import { FONTES_LEAD } from '@/lib/validations/crm'

import {
  ETAPA_INICIAL_FRIO,
  NOME_PIPELINE_FRIO,
  ehLeadFrio,
} from './roteamento'

describe('constantes do pipeline Frio', () => {
  it('usa os nomes pt-BR exatos, com acento', () => {
    expect(NOME_PIPELINE_FRIO).toBe('Prospecção Fria')
    expect(ETAPA_INICIAL_FRIO).toBe('A Abordar')
  })
})

describe('ehLeadFrio', () => {
  it('Test 1: prospeccao_fria é o ÚNICO que roteia para o Frio', () => {
    expect(ehLeadFrio('prospeccao_fria')).toBe(true)
  })

  it('Test 2: toda outra fonte de FONTES_LEAD continua no funil padrão', () => {
    // Iterar sobre FONTES_LEAD (não uma lista fixa) garante que uma fonte NOVA
    // adicionada no futuro NÃO caia no Frio silenciosamente — o teste quebra e
    // força a decisão consciente.
    for (const fonte of FONTES_LEAD) {
      if (fonte === 'prospeccao_fria') continue
      expect(ehLeadFrio(fonte)).toBe(false)
    }
  })

  it('Test 3: fonte desconhecida ou vazia nunca roteia para o Frio', () => {
    expect(ehLeadFrio('')).toBe(false)
    expect(ehLeadFrio('fonte_inexistente')).toBe(false)
    expect(ehLeadFrio('PROSPECCAO_FRIA')).toBe(false)
    expect(ehLeadFrio('prospeccao')).toBe(false)
  })
})
