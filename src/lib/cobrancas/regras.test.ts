import { describe, it, expect } from 'vitest'

import {
  competenciaDe,
  dataVencimento,
  contratoElegivel,
  competenciasPendentes,
  deveUsarAsaas,
} from './regras'

describe('deveUsarAsaas', () => {
  it('true para modo automatico_asaas', () => {
    expect(deveUsarAsaas({ modoCobranca: 'automatico_asaas' })).toBe(true)
  })

  it('false para modo manual_pix', () => {
    expect(deveUsarAsaas({ modoCobranca: 'manual_pix' })).toBe(false)
  })

  it('false para modo desconhecido ou nulo (dado legado) — nunca cobrar taxa por engano', () => {
    expect(deveUsarAsaas({ modoCobranca: null })).toBe(false)
    expect(deveUsarAsaas({ modoCobranca: '' })).toBe(false)
    expect(deveUsarAsaas({ modoCobranca: 'qualquer_coisa' })).toBe(false)
  })
})

describe('competenciaDe', () => {
  it('extrai YYYY-MM de uma data YYYY-MM-DD', () => {
    expect(competenciaDe('2026-07-16')).toBe('2026-07')
    expect(competenciaDe('2026-01-01')).toBe('2026-01')
    expect(competenciaDe('2025-12-31')).toBe('2025-12')
  })
})

describe('dataVencimento', () => {
  it('usa o diaPagamento dentro da competência', () => {
    expect(dataVencimento('2026-08', 10, '2026-07-01', '2026-07-16')).toBe('2026-08-10')
    expect(dataVencimento('2026-08', 5, '2026-07-01', '2026-07-16')).toBe('2026-08-05')
  })

  it('grampeia o diaPagamento ao último dia do mês (31 → 28 em fevereiro)', () => {
    expect(dataVencimento('2026-02', 31, '2025-01-31', '2026-01-10')).toBe('2026-02-28')
    // ano bissexto: fevereiro de 2028 tem 29 dias
    expect(dataVencimento('2028-02', 31, '2025-01-31', '2028-01-10')).toBe('2028-02-29')
    expect(dataVencimento('2026-04', 31, '2025-01-31', '2026-03-10')).toBe('2026-04-30')
  })

  it('sem diaPagamento usa o dia da dataInicio do contrato', () => {
    expect(dataVencimento('2026-08', null, '2026-07-15', '2026-07-16')).toBe('2026-08-15')
    // dia da dataInicio também grampeia (31 em mês de 30)
    expect(dataVencimento('2026-09', null, '2026-07-31', '2026-07-31')).toBe('2026-09-30')
  })

  it('nunca retorna data no passado quando gerada no próprio mês (mínimo = hoje)', () => {
    // hoje 2026-07-16 e vencimento cairia em 2026-07-05 → mínimo hoje
    expect(dataVencimento('2026-07', 5, '2026-01-05', '2026-07-16')).toBe('2026-07-16')
    // vencimento futuro no mesmo mês fica intacto
    expect(dataVencimento('2026-07', 25, '2026-01-05', '2026-07-16')).toBe('2026-07-25')
    // competência futura não é afetada pelo mínimo
    expect(dataVencimento('2026-08', 5, '2026-01-05', '2026-07-16')).toBe('2026-08-05')
  })
})

describe('contratoElegivel', () => {
  const base = {
    statusFluxo: 'assinado' as string | null,
    dataInicio: '2026-06-01',
    dataVencimento: '2027-05-31',
  }

  it('true quando assinado e hoje dentro da vigência', () => {
    expect(contratoElegivel(base, '2026-07-16')).toBe(true)
    expect(contratoElegivel(base, '2026-06-01')).toBe(true)
    expect(contratoElegivel(base, '2027-05-31')).toBe(true)
  })

  it('false quando não assinado', () => {
    expect(contratoElegivel({ ...base, statusFluxo: 'aguardando_assinatura' }, '2026-07-16')).toBe(false)
    expect(contratoElegivel({ ...base, statusFluxo: null }, '2026-07-16')).toBe(false)
  })

  it('false fora da vigência', () => {
    expect(contratoElegivel(base, '2026-05-31')).toBe(false)
    expect(contratoElegivel(base, '2027-06-01')).toBe(false)
  })
})

describe('competenciasPendentes', () => {
  const contrato = {
    dataInicio: '2026-05-01',
    dataVencimento: '2027-04-30',
    assinadoEm: '2026-05-10' as string | null,
  }

  it('lista da competência inicial até o mês atual, pulando as já geradas', () => {
    expect(competenciasPendentes(contrato, [], '2026-07-16')).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
    ])
    expect(competenciasPendentes(contrato, ['2026-05', '2026-06'], '2026-07-16')).toEqual([
      '2026-07',
    ])
    expect(
      competenciasPendentes(contrato, ['2026-05', '2026-06', '2026-07'], '2026-07-16'),
    ).toEqual([])
  })

  it('começa em max(mês da assinatura, mês da dataInicio)', () => {
    // assinado ANTES do início do contrato → começa no mês da dataInicio
    expect(
      competenciasPendentes(
        { dataInicio: '2026-08-01', dataVencimento: '2027-07-31', assinadoEm: '2026-07-10' },
        [],
        '2026-08-16',
      ),
    ).toEqual(['2026-08'])
    // assinado DEPOIS do início → começa no mês da assinatura (não cobra retroativo)
    expect(
      competenciasPendentes(
        { dataInicio: '2026-03-01', dataVencimento: '2027-02-28', assinadoEm: '2026-06-20' },
        [],
        '2026-07-16',
      ),
    ).toEqual(['2026-06', '2026-07'])
  })

  it('sem assinadoEm usa o mês da dataInicio', () => {
    expect(
      competenciasPendentes(
        { dataInicio: '2026-06-15', dataVencimento: '2027-06-14', assinadoEm: null },
        [],
        '2026-07-16',
      ),
    ).toEqual(['2026-06', '2026-07'])
  })

  it('respeita a dataVencimento do contrato (não gera competência após o fim)', () => {
    expect(
      competenciasPendentes(
        { dataInicio: '2026-01-01', dataVencimento: '2026-03-31', assinadoEm: '2026-01-05' },
        [],
        '2026-07-16',
      ),
    ).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('contrato começando no futuro não gera nada ainda', () => {
    expect(
      competenciasPendentes(
        { dataInicio: '2026-09-01', dataVencimento: '2027-08-31', assinadoEm: null },
        [],
        '2026-07-16',
      ),
    ).toEqual([])
  })
})
