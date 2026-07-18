import { describe, expect, it } from 'vitest'

import { ehEtapaReuniaoAgendada, montarInstanteBrasilia } from './reuniao'

// Detecção da coluna "Reunião agendada" por NOME (as etapas são linhas do
// banco, sem chave semântica) — tolerante a acento, caixa e espaços, mas
// EXATA no texto: "Reunião realizada" não pode disparar o modal.

describe('ehEtapaReuniaoAgendada', () => {
  it('reconhece o nome canônico com acento', () => {
    expect(ehEtapaReuniaoAgendada('Reunião agendada')).toBe(true)
  })

  it('reconhece sem acento e em minúsculas', () => {
    expect(ehEtapaReuniaoAgendada('reuniao agendada')).toBe(true)
  })

  it('tolera espaços nas pontas e caixa mista', () => {
    expect(ehEtapaReuniaoAgendada('  Reunião Agendada  ')).toBe(true)
  })

  it('rejeita outras etapas do pipeline', () => {
    expect(ehEtapaReuniaoAgendada('Proposta enviada')).toBe(false)
  })

  it('rejeita nomes parecidos mas diferentes (só a etapa exata)', () => {
    expect(ehEtapaReuniaoAgendada('Reunião realizada')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(ehEtapaReuniaoAgendada('')).toBe(false)
  })
})

// O instante gravado no banco precisa ser o horário de Brasília convertido
// para UTC (offset -03:00 explícito), independente do fuso do processo —
// na Vercel (UTC) o `new Date` sem offset gravava 3h a mais.

describe('montarInstanteBrasilia', () => {
  it('converte 15:00 BRT em 18:00 UTC', () => {
    expect(montarInstanteBrasilia('2026-07-20', '15:00').getTime()).toBe(
      Date.parse('2026-07-20T18:00:00Z'),
    )
  })

  it('preserva os minutos (15:40 BRT → 18:40 UTC)', () => {
    expect(montarInstanteBrasilia('2026-07-20', '15:40').getTime()).toBe(
      Date.parse('2026-07-20T18:40:00Z'),
    )
  })

  it('vira o dia quando a hora local passa de 21:00 (22:30 BRT → 01:30 UTC do dia seguinte)', () => {
    expect(montarInstanteBrasilia('2026-07-20', '22:30').getTime()).toBe(
      Date.parse('2026-07-21T01:30:00Z'),
    )
  })
})
