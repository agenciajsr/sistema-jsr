import { describe, expect, it } from 'vitest'

import { ehEtapaReuniaoAgendada } from './reuniao'

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
