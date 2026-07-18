import { describe, expect, it } from 'vitest'

import {
  SLA_PRIMEIRO_CONTATO_HORAS,
  estourouSla,
  horasAguardando,
  textoAguardando,
} from './sla-contato'

const AGORA = new Date('2026-07-17T12:00:00-03:00')

function horasAtras(h: number): Date {
  return new Date(AGORA.getTime() - h * 60 * 60 * 1000)
}

describe('SLA_PRIMEIRO_CONTATO_HORAS', () => {
  it('e 1 hora (lead quente esfria em minutos)', () => {
    expect(SLA_PRIMEIRO_CONTATO_HORAS).toBe(1)
  })
})

describe('horasAguardando', () => {
  it('retorna horas decimais desde a criacao', () => {
    expect(horasAguardando(horasAtras(3), AGORA)).toBeCloseTo(3)
    expect(horasAguardando(horasAtras(26.5), AGORA)).toBeCloseTo(26.5)
  })

  it('aceita string ISO', () => {
    expect(horasAguardando(horasAtras(5).toISOString(), AGORA)).toBeCloseTo(5)
  })

  it('nunca retorna negativo (criada no futuro por relogio torto)', () => {
    expect(horasAguardando(horasAtras(-2), AGORA)).toBe(0)
  })
})

describe('estourouSla', () => {
  it('menos de 1h nao estourou', () => {
    expect(estourouSla(horasAtras(0.99), AGORA)).toBe(false)
  })

  it('1h EM PONTO conta como estourado', () => {
    expect(estourouSla(horasAtras(1), AGORA)).toBe(true)
  })

  it('mais de 1h estourou', () => {
    expect(estourouSla(horasAtras(5), AGORA)).toBe(true)
  })
})

describe('textoAguardando', () => {
  it('horas inteiras abaixo de 48h', () => {
    expect(textoAguardando(3)).toBe('aguardando 1º contato há 3h')
    expect(textoAguardando(3.9)).toBe('aguardando 1º contato há 3h')
    expect(textoAguardando(26)).toBe('aguardando 1º contato há 26h')
  })

  it('a partir de 48h vira dias', () => {
    expect(textoAguardando(48)).toBe('aguardando 1º contato há 2d')
    expect(textoAguardando(71)).toBe('aguardando 1º contato há 2d')
    expect(textoAguardando(72)).toBe('aguardando 1º contato há 3d')
  })
})
