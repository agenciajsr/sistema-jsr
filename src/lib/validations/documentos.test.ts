import { describe, it, expect } from 'vitest'

import { validarCpf, validarCnpj, formatarCpf, formatarCnpj } from './documentos'

// Validação de CPF/CNPJ com dígito verificador — módulo PURO (zero db/react).
// Usada tanto no client (formulário público) quanto no server (action pública).

describe('validarCpf', () => {
  it('aceita CPF válido sem máscara', () => {
    expect(validarCpf('52998224725')).toBe(true)
  })

  it('aceita CPF válido com máscara', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(validarCpf('52998224724')).toBe(false)
    expect(validarCpf('529.982.247-15')).toBe(false)
  })

  it('rejeita tamanho errado', () => {
    expect(validarCpf('5299822472')).toBe(false)
    expect(validarCpf('529982247250')).toBe(false)
    expect(validarCpf('')).toBe(false)
  })

  it('rejeita todos os dígitos iguais (111.111.111-11)', () => {
    expect(validarCpf('111.111.111-11')).toBe(false)
    expect(validarCpf('00000000000')).toBe(false)
    expect(validarCpf('99999999999')).toBe(false)
  })

  it('rejeita lixo não numérico', () => {
    expect(validarCpf('abc.def.ghi-jk')).toBe(false)
  })
})

describe('validarCnpj', () => {
  it('aceita CNPJ válido sem máscara', () => {
    expect(validarCnpj('11222333000181')).toBe(true)
  })

  it('aceita CNPJ válido com máscara', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(validarCnpj('11222333000182')).toBe(false)
    expect(validarCnpj('11.222.333/0001-80')).toBe(false)
  })

  it('rejeita tamanho errado', () => {
    expect(validarCnpj('1122233300018')).toBe(false)
    expect(validarCnpj('112223330001811')).toBe(false)
    expect(validarCnpj('')).toBe(false)
  })

  it('rejeita todos os dígitos iguais', () => {
    expect(validarCnpj('11111111111111')).toBe(false)
    expect(validarCnpj('00000000000000')).toBe(false)
  })
})

describe('formatarCpf', () => {
  it('formata 11 dígitos como 000.000.000-00', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
  })

  it('mantém parcial enquanto digita (máscara progressiva)', () => {
    expect(formatarCpf('529982')).toBe('529.982')
    expect(formatarCpf('529982247')).toBe('529.982.247')
  })

  it('ignora caracteres não numéricos da entrada', () => {
    expect(formatarCpf('529.982.247-25')).toBe('529.982.247-25')
  })
})

describe('formatarCnpj', () => {
  it('formata 14 dígitos como 00.000.000/0000-00', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('mantém parcial enquanto digita', () => {
    expect(formatarCnpj('112223')).toBe('11.222.3')
  })

  it('ignora caracteres não numéricos da entrada', () => {
    expect(formatarCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81')
  })
})
