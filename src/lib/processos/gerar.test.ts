import { describe, it, expect } from 'vitest'

import {
  tituloDoProcesso,
  etiquetaDoProcesso,
  grupoDoProcesso,
  itensParaChecklist,
  hojeBrasilia,
} from './gerar'

describe('tituloDoProcesso', () => {
  it('monta o título com travessão e o nome do cliente', () => {
    expect(tituloDoProcesso('onboarding', 'Luzzia')).toBe('Onboarding — Luzzia')
    expect(tituloDoProcesso('retencao', 'Helena')).toBe('Retenção — Helena')
    expect(tituloDoProcesso('saida', 'Studio X')).toBe('Encerramento — Studio X')
  })
})

describe('etiquetaDoProcesso', () => {
  it('chave técnica ESTÁVEL de idempotência: processo:{tipo}', () => {
    expect(etiquetaDoProcesso('onboarding')).toBe('processo:onboarding')
    expect(etiquetaDoProcesso('retencao')).toBe('processo:retencao')
    expect(etiquetaDoProcesso('saida')).toBe('processo:saida')
  })
})

describe('grupoDoProcesso', () => {
  it('nome legível do grupo do checklist', () => {
    expect(grupoDoProcesso('onboarding')).toBe('Onboarding')
    expect(grupoDoProcesso('retencao')).toBe('Retenção')
    expect(grupoDoProcesso('saida')).toBe('Encerramento')
  })
})

describe('itensParaChecklist', () => {
  it('preserva a ordem do modelo', () => {
    const modelo = [
      { titulo: 'Reunião de kickoff', ordem: 0, opcional: false },
      { titulo: 'Acessos das contas', ordem: 1, opcional: false },
    ]
    expect(itensParaChecklist(modelo)).toEqual([
      { texto: 'Reunião de kickoff', ordem: 0 },
      { texto: 'Acessos das contas', ordem: 1 },
    ])
  })

  it("item opcional ganha sufixo ' (opcional)' no texto", () => {
    const modelo = [{ titulo: 'Gravar depoimento', ordem: 3, opcional: true }]
    expect(itensParaChecklist(modelo)).toEqual([
      { texto: 'Gravar depoimento (opcional)', ordem: 3 },
    ])
  })

  it('lista vazia devolve []', () => {
    expect(itensParaChecklist([])).toEqual([])
  })
})

describe('hojeBrasilia', () => {
  it("converte o 'agora' UTC para 'YYYY-MM-DD' no fuso America/Sao_Paulo", () => {
    // 18/07 15:00 UTC = 12:00 em Brasília → mesmo dia.
    expect(hojeBrasilia(new Date('2026-07-18T15:00:00.000Z'))).toBe('2026-07-18')
  })

  it('madrugada UTC cai no dia ANTERIOR em BR (UTC-3)', () => {
    // 18/07 01:00 UTC = 17/07 22:00 em Brasília.
    expect(hojeBrasilia(new Date('2026-07-18T01:00:00.000Z'))).toBe('2026-07-17')
  })
})
