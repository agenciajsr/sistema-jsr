import { describe, expect, it } from 'vitest'

import { avaliarRegrasDiarias, labelAccountStatus, type EntradaRegrasCliente } from './regras-campanha'

const base: EntradaRegrasCliente = {
  clienteId: 'cli-1',
  clienteNome: 'Cliente Teste',
  labelHeroi: 'Leads',
  metaCusto: { bom: 15, ruim: 20 },
  dias: [],
  anuncios: [],
  contasComProblema: [],
}

const HOJE = '2026-07-17'

function dia(campaignId: string, date: string, spend: number, impressions: number, resultadoHeroi: number) {
  return { campaignId, campaignName: `Campanha ${campaignId}`, date, spend, impressions, resultadoHeroi }
}

describe('gasto_sem_resultado', () => {
  it('gasto >= R$50 no dia de referência com 0 resultados = crítico; abaixo de R$50 não dispara', () => {
    const alertas = avaliarRegrasDiarias(
      { ...base, dias: [dia('c1', '2026-07-16', 80, 5000, 0), dia('c2', '2026-07-16', 40, 3000, 0)] },
      HOJE,
    )
    const doTipo = alertas.filter((a) => a.tipo === 'gasto_sem_resultado')
    expect(doTipo).toHaveLength(1)
    expect(doTipo[0].severidade).toBe('critico')
    expect(doTipo[0].id).toContain('c1')
  })

  it('segundo sync com a mesma condição gera a MESMA chave (dedup no persistir)', () => {
    const entrada = { ...base, dias: [dia('c1', '2026-07-16', 80, 5000, 0)] }
    const a1 = avaliarRegrasDiarias(entrada, HOJE).find((a) => a.tipo === 'gasto_sem_resultado')
    const a2 = avaliarRegrasDiarias(entrada, HOJE).find((a) => a.tipo === 'gasto_sem_resultado')
    expect(a1?.id).toBe(a2?.id)
  })
})

describe('custo_acima_meta (3 dias seguidos)', () => {
  it('3 dias com custo acima do warn dispara; 2 dias não', () => {
    const tresDias = [
      dia('c1', '2026-07-16', 100, 5000, 2), // custo 50
      dia('c1', '2026-07-15', 100, 5000, 3), // 33
      dia('c1', '2026-07-14', 100, 5000, 4), // 25
    ]
    expect(
      avaliarRegrasDiarias({ ...base, dias: tresDias }, HOJE).some((a) => a.tipo === 'custo_acima_meta'),
    ).toBe(true)

    const doisDias = tresDias.slice(0, 2)
    expect(
      avaliarRegrasDiarias({ ...base, dias: doisDias }, HOJE).some((a) => a.tipo === 'custo_acima_meta'),
    ).toBe(false)
  })

  it('um dia dentro da meta zera a sequência; sem meta configurada não avalia', () => {
    const dias = [
      dia('c1', '2026-07-16', 100, 5000, 2), // 50 (acima)
      dia('c1', '2026-07-15', 100, 5000, 10), // 10 (dentro)
      dia('c1', '2026-07-14', 100, 5000, 2), // 50 (acima)
    ]
    expect(avaliarRegrasDiarias({ ...base, dias }, HOJE).some((a) => a.tipo === 'custo_acima_meta')).toBe(false)
    expect(
      avaliarRegrasDiarias({ ...base, metaCusto: null, dias }, HOJE).some((a) => a.tipo === 'custo_acima_meta'),
    ).toBe(false)
  })
})

describe('ctr_baixo (nível anúncio)', () => {
  it('CTR link < 1% com >= 1500 impressões dispara; volume baixo não', () => {
    const alertas = avaliarRegrasDiarias(
      {
        ...base,
        anuncios: [
          { adId: 'ad1', adName: 'Anúncio fraco', impressions: 2000, linkClicks: 10 }, // 0,5%
          { adId: 'ad2', adName: 'Pouco volume', impressions: 800, linkClicks: 1 },
          { adId: 'ad3', adName: 'Bom', impressions: 5000, linkClicks: 100 }, // 2%
        ],
      },
      HOJE,
    )
    const doTipo = alertas.filter((a) => a.tipo === 'ctr_baixo')
    expect(doTipo).toHaveLength(1)
    expect(doTipo[0].id).toContain('ad1')
  })
})

describe('gasto_disparado (pico do dia vs 7 anteriores)', () => {
  it('dia de referência > 2x a média anterior dispara; gasto estável não', () => {
    const estaveis = ['2026-07-13', '2026-07-14', '2026-07-15'].map((d) => dia('c1', d, 100, 5000, 5))
    const pico = [dia('c1', '2026-07-16', 350, 15000, 10), ...estaveis]
    expect(avaliarRegrasDiarias({ ...base, dias: pico }, HOJE).some((a) => a.tipo === 'gasto_disparado')).toBe(true)

    const semPico = [dia('c1', '2026-07-16', 120, 6000, 6), ...estaveis]
    expect(avaliarRegrasDiarias({ ...base, dias: semPico }, HOJE).some((a) => a.tipo === 'gasto_disparado')).toBe(false)
  })
})

describe('entrega_parada', () => {
  it('impressões 0 no dia de referência com >0 no anterior = crítico', () => {
    // c1 entregava e parou (linha do dia 16 existe com 0 impressões)
    const dias = [dia('c1', '2026-07-16', 0, 0, 0), dia('c1', '2026-07-15', 50, 4000, 3)]
    const alertas = avaliarRegrasDiarias({ ...base, dias }, HOJE)
    expect(alertas.some((a) => a.tipo === 'entrega_parada')).toBe(true)
  })

  it('campanha SEM linha no dia de referência (outra campanha tem) também conta como parada', () => {
    const dias = [
      dia('c2', '2026-07-16', 100, 8000, 5), // c2 define o dia de referência
      dia('c1', '2026-07-15', 50, 4000, 3), // c1 sumiu no dia 16
    ]
    const alertas = avaliarRegrasDiarias({ ...base, dias }, HOJE)
    const parada = alertas.filter((a) => a.tipo === 'entrega_parada')
    expect(parada).toHaveLength(1)
    expect(parada[0].id).toContain('c1')
  })
})

describe('conta_com_problema', () => {
  it('conta com status != ATIVA vira alerta crítico', () => {
    const alertas = avaliarRegrasDiarias(
      { ...base, contasComProblema: [{ nome: 'Conta X', statusLabel: labelAccountStatus(3) }] },
      HOJE,
    )
    const doTipo = alertas.filter((a) => a.tipo === 'conta_com_problema')
    expect(doTipo).toHaveLength(1)
    expect(doTipo[0].severidade).toBe('critico')
    expect(doTipo[0].detalhe).toContain('PENDÊNCIA DE PAGAMENTO')
  })
})
