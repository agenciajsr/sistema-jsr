import { describe, it, expect } from 'vitest'

import { normalizarTelefone, dedupHash } from './lead'

describe('normalizarTelefone', () => {
  it('Test 1 — remove tudo que não é dígito', () => {
    expect(normalizarTelefone('(31) 99876-5432')).toBe('31998765432')
  })

  it('Test 2 — preserva o DDI quando presente', () => {
    expect(normalizarTelefone('+55 31 9 9876-5432')).toBe('5531998765432')
  })

  it('Test 3 — vazio, null e undefined viram null', () => {
    expect(normalizarTelefone('')).toBeNull()
    expect(normalizarTelefone(null)).toBeNull()
    expect(normalizarTelefone(undefined)).toBeNull()
    // Só símbolos (zero dígitos) também vira null
    expect(normalizarTelefone('abc-')).toBeNull()
  })
})

describe('dedupHash', () => {
  it('Test 4 — email é case-insensitive: mesmo lead no mesmo dia gera o MESMO hash', () => {
    const a = dedupHash('landing_page', 'Ana@Ex.com', null, '2026-07-15')
    const b = dedupHash('landing_page', 'ana@ex.com', null, '2026-07-15')
    expect(a).toBe(b)
  })

  it('Test 5 — fontes diferentes geram hashes DIFERENTES', () => {
    const a = dedupHash('landing_page', 'ana@ex.com', null, '2026-07-15')
    const b = dedupHash('meta_lead_ad', 'ana@ex.com', null, '2026-07-15')
    expect(a).not.toBe(b)
  })

  it('Test 6 — dias diferentes geram hashes DIFERENTES', () => {
    const a = dedupHash('landing_page', 'ana@ex.com', null, '2026-07-15')
    const b = dedupHash('landing_page', 'ana@ex.com', null, '2026-07-16')
    expect(a).not.toBe(b)
  })

  it('Test 7 — sem email, usa o telefone normalizado como identidade', () => {
    const a = dedupHash('landing_page', null, '31998765432', '2026-07-15')
    const b = dedupHash('landing_page', undefined, '31998765432', '2026-07-15')
    expect(a).toBe(b)

    const c = dedupHash('landing_page', null, '31911112222', '2026-07-15')
    expect(a).not.toBe(c)
  })

  it('Test 8 — sempre retorna 64 chars hexadecimais (sha256)', () => {
    const casos = [
      dedupHash('landing_page', 'ana@ex.com', null, '2026-07-15'),
      dedupHash('whatsapp', null, '31998765432', '2026-07-15'),
      dedupHash('outro', null, null, '2026-07-15'),
    ]
    for (const hash of casos) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('Test 9 — email presente tem precedência sobre o telefone', () => {
    const soEmail = dedupHash('landing_page', 'ana@ex.com', null, '2026-07-15')
    const emailETelefone = dedupHash('landing_page', 'ana@ex.com', '31998765432', '2026-07-15')
    expect(soEmail).toBe(emailETelefone)
  })
})
