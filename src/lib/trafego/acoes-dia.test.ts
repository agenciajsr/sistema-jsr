import { describe, expect, it } from 'vitest'

import { calcularAcoesDoDia, type EntradaAcoes } from './acoes-dia'

const HOJE = '2026-07-17'

const base: EntradaAcoes = {
  metaCusto: { bom: 15, ruim: 20 },
  anuncios: [],
  dias: [],
  campanhasComAlerta: new Set(),
  clienteTemAlerta: false,
}

// Dias 11..17 = janela atual (corte = hoje-6); 04..10 = anterior.
function dia(campaignId: string, date: string, over: Partial<Parameters<typeof Object.assign>[1]> = {}) {
  return {
    campaignId,
    campaignName: `Campanha ${campaignId}`,
    date,
    spend: 100,
    impressions: 5000,
    reach: 4000,
    linkClicks: 100,
    resultadoHeroi: 10, // custo 10 (dentro da meta boa 15)
    ...over,
  }
}

const DIAS_ATUAIS = ['2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']
const DIAS_ANTERIORES = ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']

describe('cortar (nível anúncio)', () => {
  it('CTR < 1% com >= 1500 impressões entra na lista', () => {
    const acoes = calcularAcoesDoDia(
      { ...base, anuncios: [{ adId: 'a1', adName: 'Fraco', thumbnailUrl: null, spend: 30, impressions: 2000, linkClicks: 10, resultadoHeroi: 1 }] },
      HOJE,
    )
    expect(acoes.filter((a) => a.tipo === 'cortar')).toHaveLength(1)
  })

  it('custo/resultado > 1,5x a meta com gasto >= R$50 entra; anúncio bom não', () => {
    const acoes = calcularAcoesDoDia(
      {
        ...base,
        anuncios: [
          { adId: 'a1', adName: 'Caro', thumbnailUrl: null, spend: 100, impressions: 5000, linkClicks: 100, resultadoHeroi: 4 }, // custo 25 > 22,5
          { adId: 'a2', adName: 'Bom', thumbnailUrl: null, spend: 100, impressions: 5000, linkClicks: 100, resultadoHeroi: 10 },
        ],
      },
      HOJE,
    )
    const cortar = acoes.filter((a) => a.tipo === 'cortar')
    expect(cortar).toHaveLength(1)
    expect(cortar[0].entidadeId).toBe('a1')
  })
})

describe('escalar (nível campanha)', () => {
  it('custo estável dentro da meta boa, freq < 3 e sem alerta = recomenda +20%', () => {
    const dias = DIAS_ATUAIS.map((d) => dia('c1', d))
    const acoes = calcularAcoesDoDia({ ...base, dias }, HOJE)
    const escalar = acoes.filter((a) => a.tipo === 'escalar')
    expect(escalar).toHaveLength(1)
    expect(escalar[0].recomendacao).toContain('20%')
  })

  it('campanha com alerta ativo NÃO recomenda escalar (critério de aceite)', () => {
    const dias = DIAS_ATUAIS.map((d) => dia('c1', d))
    const acoes = calcularAcoesDoDia({ ...base, dias, campanhasComAlerta: new Set(['c1']) }, HOJE)
    expect(acoes.some((a) => a.tipo === 'escalar')).toBe(false)
  })

  it('frequência 7d >= 3 bloqueia o escalar', () => {
    const dias = DIAS_ATUAIS.map((d) => dia('c1', d, { reach: 1000 })) // freq 5000*7/7000 = 5
    const acoes = calcularAcoesDoDia({ ...base, dias }, HOJE)
    expect(acoes.some((a) => a.tipo === 'escalar')).toBe(false)
  })
})

describe('renovar criativo (nível campanha)', () => {
  it('frequência > 3 com resultado dentro da meta = renovar', () => {
    const dias = DIAS_ATUAIS.map((d) => dia('c1', d, { reach: 1000 }))
    const acoes = calcularAcoesDoDia({ ...base, dias }, HOJE)
    expect(acoes.some((a) => a.tipo === 'renovar')).toBe(true)
  })

  it('CTR caindo >= 30% (7d vs 7d) com custo na meta = renovar', () => {
    const atuais = DIAS_ATUAIS.map((d) => dia('c1', d, { linkClicks: 50 })) // CTR 1%
    const anteriores = DIAS_ANTERIORES.map((d) => dia('c1', d, { linkClicks: 100 })) // CTR 2%
    const acoes = calcularAcoesDoDia({ ...base, dias: [...atuais, ...anteriores] }, HOJE)
    expect(acoes.some((a) => a.tipo === 'renovar')).toBe(true)
  })

  it('campanha fora da meta NÃO entra em renovar (vai pra outra conversa)', () => {
    const dias = DIAS_ATUAIS.map((d) => dia('c1', d, { reach: 1000, resultadoHeroi: 2 })) // custo 50 > ruim 20
    const acoes = calcularAcoesDoDia({ ...base, dias }, HOJE)
    expect(acoes.some((a) => a.tipo === 'renovar')).toBe(false)
  })
})

describe('estado vazio', () => {
  it('sem dados = nenhuma ação', () => {
    expect(calcularAcoesDoDia(base, HOJE)).toHaveLength(0)
  })
})
