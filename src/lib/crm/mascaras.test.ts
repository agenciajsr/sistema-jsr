import { describe, it, expect } from 'vitest'

import { mascararTelefone, mascararDocumento } from '@/lib/crm/mascaras'

// Mascaras PROGRESSIVAS: rodam a cada tecla digitada, entao precisam funcionar
// com a entrada pela METADE e nunca lancar. Elas sao so apresentacao — o que
// deduplica e vai pro banco continua sendo o telefone normalizado (so digitos).

describe('mascararTelefone', () => {
  it('formata celular de 11 digitos', () => {
    expect(mascararTelefone('31998765432')).toBe('(31) 99876-5432')
  })

  it('formata fixo de 10 digitos', () => {
    expect(mascararTelefone('3132345678')).toBe('(31) 3234-5678')
  })

  it('formata parcial enquanto o usuario digita o DDD', () => {
    expect(mascararTelefone('31')).toBe('(31')
  })

  it('vazio continua vazio (nao vira apenas o parentese)', () => {
    expect(mascararTelefone('')).toBe('')
  })

  it('trunca em 11 digitos sem estourar', () => {
    expect(mascararTelefone('319987654321999')).toBe('(31) 99876-5432')
  })

  it('texto sem nenhum digito vira vazio', () => {
    expect(mascararTelefone('abc')).toBe('')
  })
})

describe('mascararDocumento', () => {
  it('formata CPF de 11 digitos', () => {
    expect(mascararDocumento('12345678901')).toBe('123.456.789-01')
  })

  it('formata CNPJ de 14 digitos', () => {
    expect(mascararDocumento('12345678000199')).toBe('12.345.678/0001-99')
  })

  it('formata parcial enquanto o usuario digita', () => {
    expect(mascararDocumento('123')).toBe('123')
  })

  it('vazio continua vazio', () => {
    expect(mascararDocumento('')).toBe('')
  })
})
