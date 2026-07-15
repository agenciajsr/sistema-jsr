import { describe, it, expect } from 'vitest'

import { tempoRelativoCurto } from './tempo'

// `agora` fixo: os testes nao dependem de Date.now(), sao deterministicos.
const AGORA = new Date('2026-07-15T12:00:00Z')

function haSegundos(s: number): Date {
  return new Date(AGORA.getTime() - s * 1000)
}

describe('tempoRelativoCurto', () => {
  it('Test 1: 30s atras -> "agora"', () => {
    expect(tempoRelativoCurto(haSegundos(30), AGORA)).toBe('agora')
  })

  it('Test 2: 5 min atras -> "5min"', () => {
    expect(tempoRelativoCurto(haSegundos(5 * 60), AGORA)).toBe('5min')
  })

  it('Test 3: 3h atras -> "3h"', () => {
    expect(tempoRelativoCurto(haSegundos(3 * 60 * 60), AGORA)).toBe('3h')
  })

  it('Test 4: 15 dias atras -> "15d"', () => {
    expect(tempoRelativoCurto(haSegundos(15 * 24 * 60 * 60), AGORA)).toBe('15d')
  })

  it('Test 5: ~65 dias atras -> "2m"', () => {
    expect(tempoRelativoCurto(haSegundos(65 * 24 * 60 * 60), AGORA)).toBe('2m')
  })

  it('Test 6: ~2 anos atras -> "2a"', () => {
    expect(tempoRelativoCurto(haSegundos(2 * 365 * 24 * 60 * 60), AGORA)).toBe('2a')
  })

  it('aceita string ISO', () => {
    expect(tempoRelativoCurto('2026-07-15T11:59:30Z', AGORA)).toBe('agora')
  })
})
