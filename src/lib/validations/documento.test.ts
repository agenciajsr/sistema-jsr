import { describe, expect, it } from 'vitest'

import {
  mascararCEP,
  mascararCNPJ,
  mascararCPF,
  validarCNPJ,
  validarCPF,
} from './documento'

describe('validarCPF', () => {
  it('aceita CPFs válidos (dígitos verificadores corretos)', () => {
    // Gerados pelo algoritmo oficial (uso apenas em teste).
    expect(validarCPF('529.982.247-25')).toBe(true)
    expect(validarCPF('52998224725')).toBe(true)
    expect(validarCPF('111.444.777-35')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(validarCPF('529.982.247-24')).toBe(false)
    expect(validarCPF('111.444.777-36')).toBe(false)
  })

  it('rejeita sequências repetidas e tamanhos errados', () => {
    expect(validarCPF('111.111.111-11')).toBe(false)
    expect(validarCPF('000.000.000-00')).toBe(false)
    expect(validarCPF('1234567890')).toBe(false)
    expect(validarCPF('')).toBe(false)
  })
})

describe('validarCNPJ', () => {
  it('aceita CNPJs válidos', () => {
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true)
    expect(validarCNPJ('11222333000181')).toBe(true)
    // CNPJ público da Petrobras (exemplo real conhecido).
    expect(validarCNPJ('33.000.167/0001-01')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(validarCNPJ('11.222.333/0001-80')).toBe(false)
    expect(validarCNPJ('33.000.167/0001-02')).toBe(false)
  })

  it('rejeita sequências repetidas e tamanhos errados', () => {
    expect(validarCNPJ('11.111.111/1111-11')).toBe(false)
    expect(validarCNPJ('123')).toBe(false)
    expect(validarCNPJ('')).toBe(false)
  })
})

describe('máscaras progressivas', () => {
  it('CPF formata conforme digita', () => {
    expect(mascararCPF('529')).toBe('529')
    expect(mascararCPF('529982')).toBe('529.982')
    expect(mascararCPF('529982247')).toBe('529.982.247')
    expect(mascararCPF('52998224725')).toBe('529.982.247-25')
    expect(mascararCPF('529982247259999')).toBe('529.982.247-25') // trunca
  })

  it('CNPJ formata conforme digita', () => {
    expect(mascararCNPJ('11')).toBe('11')
    expect(mascararCNPJ('11222')).toBe('11.222')
    expect(mascararCNPJ('11222333')).toBe('11.222.333')
    expect(mascararCNPJ('112223330001')).toBe('11.222.333/0001')
    expect(mascararCNPJ('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('CEP formata 00000-000', () => {
    expect(mascararCEP('01310')).toBe('01310')
    expect(mascararCEP('01310930')).toBe('01310-930')
    expect(mascararCEP('01310-930')).toBe('01310-930')
  })
})
