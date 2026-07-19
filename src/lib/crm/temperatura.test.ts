import { describe, expect, it } from 'vitest'

import { temperaturaOrigem } from './temperatura'

// Temperatura do lead DERIVADA da origem (decisão registrada no quick
// 260719-s3a): sem coluna nova, sem backfill — leads antigos ganham o chip
// automaticamente e editar a origem na ficha mantém tudo consistente.

describe('temperaturaOrigem', () => {
  it('meta_lead_ad e landing_page são quentes 🔥', () => {
    expect(temperaturaOrigem('meta_lead_ad')).toBe('quente')
    expect(temperaturaOrigem('landing_page')).toBe('quente')
  })

  it('prospeccao_fria e whatsapp são frios 🧊', () => {
    expect(temperaturaOrigem('prospeccao_fria')).toBe('frio')
    expect(temperaturaOrigem('whatsapp')).toBe('frio')
  })

  it('origens neutras não têm temperatura', () => {
    expect(temperaturaOrigem('manual')).toBeNull()
    expect(temperaturaOrigem('indicacao')).toBeNull()
    expect(temperaturaOrigem('instagram')).toBeNull()
  })

  it('null/undefined/desconhecida → null', () => {
    expect(temperaturaOrigem(null)).toBeNull()
    expect(temperaturaOrigem(undefined)).toBeNull()
    expect(temperaturaOrigem('origem_que_nao_existe')).toBeNull()
  })
})
