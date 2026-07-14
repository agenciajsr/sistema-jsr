import { describe, it, expect } from 'vitest'

import {
  ocorreEm,
  datasDaRegra,
  ocorrenciasFaltantes,
  janelaMaterializacao,
} from './recorrencia'

// Calendário de referência usado nos testes (verificado):
// 2026-07-13 seg · 14 ter · 15 qua · 16 qui · 17 sex · 18 sáb · 19 dom · 20 seg

describe('ocorreEm', () => {
  it('Test 1 — dias_uteis: pula sábado e domingo', () => {
    const r = { recorrencia: 'dias_uteis' as const }
    const molde = '2026-07-13'

    // seg → sex
    expect(ocorreEm(r, molde, '2026-07-13')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-14')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-15')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-16')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-17')).toBe(true)
    // fim de semana
    expect(ocorreEm(r, molde, '2026-07-18')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-19')).toBe(false)
    // segunda seguinte
    expect(ocorreEm(r, molde, '2026-07-20')).toBe(true)
  })

  it('Test 2 — dia_sim_dia_nao: paridade contra o molde, não contra o dia do mês', () => {
    const r = { recorrencia: 'dia_sim_dia_nao' as const }
    const molde = '2026-07-13'

    expect(ocorreEm(r, molde, '2026-07-13')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-15')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-17')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-19')).toBe(true)

    expect(ocorreEm(r, molde, '2026-07-14')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-16')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-18')).toBe(false)
  })

  it('Test 2b — dia_sim_dia_nao: paridade atravessa a virada do mês', () => {
    const r = { recorrencia: 'dia_sim_dia_nao' as const }
    // 2026-07-31 é ímpar em dias desde o molde? diff(13→31) = 18 (par) ⇒ ocorre.
    expect(ocorreEm(r, '2026-07-13', '2026-07-31')).toBe(true)
    // diff(13→01/08) = 19 (ímpar) ⇒ não ocorre. Se a lógica usasse o dia do mês,
    // 31 (ímpar) → 01 (ímpar) daria o resultado errado aqui.
    expect(ocorreEm(r, '2026-07-13', '2026-08-01')).toBe(false)
    expect(ocorreEm(r, '2026-07-13', '2026-08-02')).toBe(true)
  })

  it('Test 3 — personalizada com dias [1,2,3] (seg/ter/qua)', () => {
    const r = { recorrencia: 'personalizada' as const, recorrenciaDias: [1, 2, 3] }
    const molde = '2026-07-13'

    expect(ocorreEm(r, molde, '2026-07-13')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-14')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-15')).toBe(true)

    expect(ocorreEm(r, molde, '2026-07-16')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-17')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-18')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-19')).toBe(false)
  })

  it('Test 3b — personalizada sem dias (vazio/ausente) nunca ocorre', () => {
    expect(ocorreEm({ recorrencia: 'personalizada', recorrenciaDias: [] }, '2026-07-13', '2026-07-13')).toBe(false)
    expect(ocorreEm({ recorrencia: 'personalizada' }, '2026-07-13', '2026-07-13')).toBe(false)
    expect(ocorreEm({ recorrencia: 'personalizada', recorrenciaDias: null }, '2026-07-13', '2026-07-14')).toBe(false)
  })

  it('Test 4 — semanal: molde numa terça só ocorre às terças', () => {
    const r = { recorrencia: 'semanal' as const }
    const molde = '2026-07-14' // terça

    expect(ocorreEm(r, molde, '2026-07-14')).toBe(true)
    expect(ocorreEm(r, molde, '2026-07-21')).toBe(true) // terça seguinte
    expect(ocorreEm(r, molde, '2026-07-28')).toBe(true)

    expect(ocorreEm(r, molde, '2026-07-15')).toBe(false)
    expect(ocorreEm(r, molde, '2026-07-20')).toBe(false)
  })

  it('Test 5 — mensal virando o mês: grampeia no último dia, nunca vaza', () => {
    const r = { recorrencia: 'mensal' as const }
    const molde = '2026-01-31'

    expect(ocorreEm(r, molde, '2026-01-31')).toBe(true)
    // Fevereiro não tem 31 → grampeia no dia 28.
    expect(ocorreEm(r, molde, '2026-02-28')).toBe(true)
    // JAMAIS pode vazar para março.
    expect(ocorreEm(r, molde, '2026-03-03')).toBe(false)
    expect(ocorreEm(r, molde, '2026-03-01')).toBe(false)
    // Março tem 31 → volta ao dia 31.
    expect(ocorreEm(r, molde, '2026-03-31')).toBe(true)
    expect(ocorreEm(r, molde, '2026-03-30')).toBe(false)
    // Abril tem 30 → grampeia no 30.
    expect(ocorreEm(r, molde, '2026-04-30')).toBe(true)
  })

  it('Test 5b — mensal com dia curto (dia 15) não grampeia nada', () => {
    const r = { recorrencia: 'mensal' as const }
    expect(ocorreEm(r, '2026-01-15', '2026-02-15')).toBe(true)
    expect(ocorreEm(r, '2026-01-15', '2026-02-28')).toBe(false)
  })

  it('Test 6 — anual: mesmo dia/mês do ano seguinte', () => {
    const r = { recorrencia: 'anual' as const }
    const molde = '2026-07-14'

    expect(ocorreEm(r, molde, '2027-07-14')).toBe(true)
    expect(ocorreEm(r, molde, '2027-07-15')).toBe(false)
    expect(ocorreEm(r, molde, '2027-08-14')).toBe(false)
  })

  it('Test 6b — anual com 29/fev grampeia em 28/fev no ano comum', () => {
    const r = { recorrencia: 'anual' as const }
    const molde = '2028-02-29' // 2028 é bissexto

    expect(ocorreEm(r, molde, '2029-02-28')).toBe(true) // 2029 não é bissexto
    expect(ocorreEm(r, molde, '2029-03-01')).toBe(false)
    expect(ocorreEm(r, molde, '2032-02-29')).toBe(true) // bissexto: dia exato
  })

  it('Test 7 — diaria: ocorre todo dia', () => {
    const r = { recorrencia: 'diaria' as const }
    const molde = '2026-07-13'

    for (const d of ['2026-07-13', '2026-07-14', '2026-07-18', '2026-07-19', '2026-08-01']) {
      expect(ocorreEm(r, molde, d)).toBe(true)
    }
  })

  it('Test 7b — nenhuma: não recorre (a avulsa não materializa nada)', () => {
    expect(ocorreEm({ recorrencia: 'nenhuma' }, '2026-07-13', '2026-07-13')).toBe(false)
    expect(ocorreEm({ recorrencia: 'nenhuma' }, '2026-07-13', '2026-07-14')).toBe(false)
  })

  it('Test 8 — nunca ocorre ANTES da data do molde, em toda regra', () => {
    const molde = '2026-07-13'
    const regras = [
      { recorrencia: 'diaria' as const },
      { recorrencia: 'semanal' as const },
      { recorrencia: 'mensal' as const },
      { recorrencia: 'anual' as const },
      { recorrencia: 'dia_sim_dia_nao' as const },
      { recorrencia: 'dias_uteis' as const },
      { recorrencia: 'personalizada' as const, recorrenciaDias: [0, 1, 2, 3, 4, 5, 6] },
    ]

    for (const r of regras) {
      expect(ocorreEm(r, molde, '2026-07-12')).toBe(false)
      expect(ocorreEm(r, molde, '2026-07-06')).toBe(false)
      expect(ocorreEm(r, molde, '2025-07-13')).toBe(false)
    }
  })
})

describe('datasDaRegra', () => {
  it('lista as datas de dias_uteis na janela, sem fim de semana', () => {
    expect(datasDaRegra({ recorrencia: 'dias_uteis' }, '2026-07-13', '2026-07-13', '2026-07-20')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-20',
    ])
  })

  it('nunca devolve datas anteriores ao molde, mesmo com "de" bem antes', () => {
    expect(datasDaRegra({ recorrencia: 'diaria' }, '2026-07-13', '2026-06-01', '2026-07-15')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
    ])
  })

  it('devolve [] quando a janela é inválida (ate < de)', () => {
    expect(datasDaRegra({ recorrencia: 'diaria' }, '2026-07-13', '2026-07-15', '2026-07-13')).toEqual([])
  })
})

describe('ocorrenciasFaltantes', () => {
  const molde = { data: '2026-07-13', recorrencia: 'dias_uteis' as const }

  it('Test 9 — devolve só as datas da regra que ainda não existem', () => {
    const faltantes = ocorrenciasFaltantes({
      molde,
      existentes: ['2026-07-13', '2026-07-15'],
      de: '2026-07-13',
      ate: '2026-07-17',
    })
    expect(faltantes).toEqual(['2026-07-14', '2026-07-16', '2026-07-17'])
  })

  it('Test 10 (IDEMPOTÊNCIA) — janela toda coberta devolve []', () => {
    const faltantes = ocorrenciasFaltantes({
      molde,
      existentes: ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'],
      de: '2026-07-13',
      ate: '2026-07-17',
    })
    expect(faltantes).toEqual([])
  })

  it('Test 11 — chamar 2× (simula abrir /tarefas duas vezes) NÃO duplica', () => {
    const de = '2026-07-13'
    const ate = '2026-07-20'

    const primeira = ocorrenciasFaltantes({ molde, existentes: [], de, ate })
    expect(primeira.length).toBeGreaterThan(0)

    // 2ª abertura: o que a 1ª criou já está no banco.
    const segunda = ocorrenciasFaltantes({ molde, existentes: primeira, de, ate })
    expect(segunda).toEqual([])
  })

  it('Test 12 — recorrencia "nenhuma" devolve [] (avulsa não materializa)', () => {
    expect(
      ocorrenciasFaltantes({
        molde: { data: '2026-07-13', recorrencia: 'nenhuma' },
        existentes: [],
        de: '2026-07-13',
        ate: '2026-07-20',
      })
    ).toEqual([])
  })

  it('Test 12b — personalizada respeita recorrenciaDias', () => {
    expect(
      ocorrenciasFaltantes({
        molde: { data: '2026-07-13', recorrencia: 'personalizada', recorrenciaDias: [1] },
        existentes: [],
        de: '2026-07-13',
        ate: '2026-07-20',
      })
    ).toEqual(['2026-07-13', '2026-07-20'])
  })
})

describe('janelaMaterializacao', () => {
  it('Test 13 — dia selecionado = hoje ⇒ de = hoje-30, ate = hoje', () => {
    expect(janelaMaterializacao('2026-07-14', '2026-07-14')).toEqual({
      de: '2026-06-14',
      ate: '2026-07-14',
    })
  })

  it('Test 14 — futuro próximo (hoje+7) ⇒ ate = hoje+7', () => {
    expect(janelaMaterializacao('2026-07-14', '2026-07-21')).toEqual({
      de: '2026-06-14',
      ate: '2026-07-21',
    })
  })

  it('Test 15 (TETO) — futuro distante (hoje+400) ⇒ ate grampeado em hoje+60', () => {
    expect(janelaMaterializacao('2026-07-14', '2027-08-18')).toEqual({
      de: '2026-06-14',
      ate: '2026-09-12', // 2026-07-14 + 60 dias
    })
  })

  it('Test 15b — dia no passado ⇒ ate = hoje (nunca menor que hoje)', () => {
    expect(janelaMaterializacao('2026-07-14', '2026-07-01')).toEqual({
      de: '2026-06-14',
      ate: '2026-07-14',
    })
  })

  it('Test 15c — sem dia selecionado ⇒ mesma janela de hoje', () => {
    expect(janelaMaterializacao('2026-07-14')).toEqual({
      de: '2026-06-14',
      ate: '2026-07-14',
    })
  })
})
