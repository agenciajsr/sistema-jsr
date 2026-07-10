import { describe, it, expect } from 'vitest'
import { contratoSchema } from '@/lib/validations/contrato'

describe('contratoSchema', () => {
  it('aceita um contrato válido', () => {
    const result = contratoSchema.safeParse({
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: 1500,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita valorMensal igual a zero', () => {
    const result = contratoSchema.safeParse({
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita valorMensal negativo', () => {
    const result = contratoSchema.safeParse({
      dataInicio: '2026-01-01',
      dataVencimento: '2026-12-31',
      valorMensal: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita dataVencimento igual a dataInicio', () => {
    const result = contratoSchema.safeParse({
      dataInicio: '2026-01-01',
      dataVencimento: '2026-01-01',
      valorMensal: 1500,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita dataVencimento anterior a dataInicio', () => {
    const result = contratoSchema.safeParse({
      dataInicio: '2026-06-01',
      dataVencimento: '2026-01-01',
      valorMensal: 1500,
    })
    expect(result.success).toBe(false)
  })

  it('rejeita dataInicio em formato inválido', () => {
    const result = contratoSchema.safeParse({
      dataInicio: 'data-invalida',
      dataVencimento: '2026-12-31',
      valorMensal: 1500,
    })
    expect(result.success).toBe(false)
  })
})
