import { describe, it, expect } from 'vitest'

import {
  proximaDataRecorrente,
  ocorrenciasRecorrentesNoIntervalo,
  datasPendentesRecorrentes,
} from './recorrencia'

describe('proximaDataRecorrente', () => {
  it('semanal soma 7 dias', () => {
    expect(proximaDataRecorrente('2026-08-21', 'semanal')).toBe('2026-08-28')
    // atravessa a virada do mês
    expect(proximaDataRecorrente('2026-08-28', 'semanal')).toBe('2026-09-04')
  })

  it('mensal soma 1 mês preservando o dia', () => {
    expect(proximaDataRecorrente('2026-08-21', 'mensal')).toBe('2026-09-21')
    expect(proximaDataRecorrente('2026-01-15', 'mensal')).toBe('2026-02-15')
  })

  it('mensal GRAMPEIA o dia ao último dia do mês alvo (31 → 28/29/30)', () => {
    // 31/jan +1 mês = 28/fev (ano comum)
    expect(proximaDataRecorrente('2026-01-31', 'mensal')).toBe('2026-02-28')
    // 31/jan +1 mês = 29/fev em ano bissexto (2028)
    expect(proximaDataRecorrente('2028-01-31', 'mensal')).toBe('2028-02-29')
    // 31 → 30 em mês de 30 dias (março → abril)
    expect(proximaDataRecorrente('2026-03-31', 'mensal')).toBe('2026-04-30')
  })

  it('trimestral soma 3 meses grampeando o dia', () => {
    expect(proximaDataRecorrente('2026-01-15', 'trimestral')).toBe('2026-04-15')
    // 31/dez +3 = 31/mar (mar tem 31), sem clamp
    expect(proximaDataRecorrente('2025-12-31', 'trimestral')).toBe('2026-03-31')
    // 30/nov +3 = 28/fev (fev do ano seguinte, clamp)
    expect(proximaDataRecorrente('2025-11-30', 'trimestral')).toBe('2026-02-28')
  })

  it('avulsa devolve a própria data (caller nunca itera avulsa)', () => {
    expect(proximaDataRecorrente('2026-08-21', 'avulsa')).toBe('2026-08-21')
  })
})

describe('ocorrenciasRecorrentesNoIntervalo', () => {
  it('enumera as datas DEPOIS de dataBase (exclusivo) dentro de [de, ate]', () => {
    // mensal, sem dataFinal, janela cobrindo 4 meses
    expect(
      ocorrenciasRecorrentesNoIntervalo(
        '2026-08-21',
        'mensal',
        null,
        '2026-09-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-09-21', '2026-10-21', '2026-11-21', '2026-12-21'])
  })

  it('respeita o teto dataFinal (nunca gera data > dataFinal)', () => {
    expect(
      ocorrenciasRecorrentesNoIntervalo(
        '2026-08-21',
        'mensal',
        '2026-10-31',
        '2026-09-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-09-21', '2026-10-21'])
  })

  it('não inclui a própria dataBase mesmo quando o intervalo começa antes dela', () => {
    expect(
      ocorrenciasRecorrentesNoIntervalo(
        '2026-08-21',
        'mensal',
        null,
        '2026-08-01',
        '2026-10-31',
      ),
    ).toEqual(['2026-09-21', '2026-10-21'])
  })

  it('semanal enumera a cada 7 dias', () => {
    expect(
      ocorrenciasRecorrentesNoIntervalo(
        '2026-08-21',
        'semanal',
        null,
        '2026-08-22',
        '2026-09-18',
      ),
    ).toEqual(['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18'])
  })

  it('avulsa devolve []', () => {
    expect(
      ocorrenciasRecorrentesNoIntervalo('2026-08-21', 'avulsa', null, '2026-01-01', '2027-01-01'),
    ).toEqual([])
  })

  it('intervalo vazio (ate < de) devolve []', () => {
    expect(
      ocorrenciasRecorrentesNoIntervalo('2026-08-21', 'mensal', null, '2026-12-31', '2026-09-01'),
    ).toEqual([])
  })
})

describe('datasPendentesRecorrentes', () => {
  it('lista as competências até hoje (teto = hoje), pulando as já geradas', () => {
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-05-21',
        recorrencia: 'mensal',
        dataFinal: null,
        jaGeradas: ['2026-05-21'],
        hoje: '2026-07-21',
      }),
    ).toEqual(['2026-06-21', '2026-07-21'])
  })

  it('é idempotente: somar o resultado a jaGeradas na 2ª rodada devolve []', () => {
    const args = {
      dataBase: '2026-05-21',
      recorrencia: 'mensal' as const,
      dataFinal: null,
      jaGeradas: ['2026-05-21'],
      hoje: '2026-07-21',
    }
    const primeira = datasPendentesRecorrentes(args)
    expect(primeira).toEqual(['2026-06-21', '2026-07-21'])
    const segunda = datasPendentesRecorrentes({
      ...args,
      jaGeradas: [...args.jaGeradas, ...primeira],
    })
    expect(segunda).toEqual([])
  })

  it('nunca gera além de hoje (teto = hoje)', () => {
    // hoje 2026-06-21: a competência de 2026-07-21 (futura) não sai
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-05-21',
        recorrencia: 'mensal',
        dataFinal: null,
        jaGeradas: ['2026-05-21'],
        hoje: '2026-06-21',
      }),
    ).toEqual(['2026-06-21'])
  })

  it('contrato já vencido encerra a série em dataFinal (dataFinal < hoje)', () => {
    // dataFinal 2026-06-30 < hoje 2026-08-01 → teto vira dataFinal
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-05-21',
        recorrencia: 'mensal',
        dataFinal: '2026-06-30',
        jaGeradas: ['2026-05-21'],
        hoje: '2026-08-01',
      }),
    ).toEqual(['2026-06-21'])
  })

  it('dataFinal no futuro não amplia além de hoje', () => {
    // dataFinal 2027-05-31 (futuro) → teto continua sendo hoje
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-05-21',
        recorrencia: 'mensal',
        dataFinal: '2027-05-31',
        jaGeradas: ['2026-05-21'],
        hoje: '2026-07-21',
      }),
    ).toEqual(['2026-06-21', '2026-07-21'])
  })

  it('semanal materializa as ocorrências pendentes da semana', () => {
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-07-01',
        recorrencia: 'semanal',
        dataFinal: null,
        jaGeradas: ['2026-07-01'],
        hoje: '2026-07-21',
      }),
    ).toEqual(['2026-07-08', '2026-07-15'])
  })

  it('trimestral respeita o passo de 3 meses', () => {
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-01-15',
        recorrencia: 'trimestral',
        dataFinal: null,
        jaGeradas: ['2026-01-15'],
        hoje: '2026-08-01',
      }),
    ).toEqual(['2026-04-15', '2026-07-15'])
  })

  it('avulsa devolve []', () => {
    expect(
      datasPendentesRecorrentes({
        dataBase: '2026-05-21',
        recorrencia: 'avulsa',
        dataFinal: null,
        jaGeradas: [],
        hoje: '2026-07-21',
      }),
    ).toEqual([])
  })
})
