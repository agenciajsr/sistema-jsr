import { describe, expect, it } from 'vitest'

import {
  PRAZOS_FOLLOWUP_HORAS,
  ehEtapaAbordado,
  ehEtapaContatoFeito,
  ehEtapaFollowup,
  ehEtapaQualificado,
  pendenciaFollowup,
} from './followup'

// Regras do follow-up de vendas (quick-260719-s3a): detecção das etapas por
// NOME normalizado (mesmo padrão de reuniao.ts) + pendências com prazos
// CRESCENTES D1..D6. Limite EM PONTO conta como vencido (convenção do
// estourouSla do SLA de 1º contato).

const HORA_MS = 60 * 60 * 1000

/** Data `horas` atrás de `agora`. */
function horasAtras(agora: Date, horas: number): Date {
  return new Date(agora.getTime() - horas * HORA_MS)
}

describe('ehEtapaFollowup', () => {
  it('reconhece o nome canônico "Follow-up"', () => {
    expect(ehEtapaFollowup('Follow-up')).toBe(true)
  })

  it('tolera a variante com espaço "follow up"', () => {
    expect(ehEtapaFollowup('follow up')).toBe(true)
  })

  it('tolera caixa alta e espaços nas pontas', () => {
    expect(ehEtapaFollowup('FOLLOW-UP ')).toBe(true)
  })

  it('tolera a variante colada "followup"', () => {
    expect(ehEtapaFollowup('followup')).toBe(true)
  })

  it('rejeita outras etapas do pipeline', () => {
    expect(ehEtapaFollowup('Contato Feito')).toBe(false)
    expect(ehEtapaFollowup('Qualificado')).toBe(false)
  })
})

describe('ehEtapaContatoFeito', () => {
  it('reconhece o nome canônico "Contato Feito"', () => {
    expect(ehEtapaContatoFeito('Contato Feito')).toBe(true)
  })

  it('tolera minúsculas', () => {
    expect(ehEtapaContatoFeito('contato feito')).toBe(true)
  })

  it('rejeita a etapa Follow-up', () => {
    expect(ehEtapaContatoFeito('Follow-up')).toBe(false)
  })
})

describe('ehEtapaAbordado', () => {
  it('reconhece "Abordado" tolerando caixa/acento/espaços', () => {
    expect(ehEtapaAbordado('Abordado')).toBe(true)
    expect(ehEtapaAbordado('abordado')).toBe(true)
    expect(ehEtapaAbordado('ABORDADO ')).toBe(true)
  })

  it('NÃO casa "A Abordar" (etapa inicial) nem outras etapas', () => {
    expect(ehEtapaAbordado('A Abordar')).toBe(false)
    expect(ehEtapaAbordado('Contato Feito')).toBe(false)
    expect(ehEtapaAbordado('Follow-up')).toBe(false)
    expect(ehEtapaAbordado('Qualificado')).toBe(false)
  })
})

describe('ehEtapaQualificado', () => {
  it('reconhece "Qualificado" tolerando caixa/acento/espaços', () => {
    expect(ehEtapaQualificado('Qualificado')).toBe(true)
    expect(ehEtapaQualificado(' qualificado ')).toBe(true)
  })

  it('NÃO casa grafias parecidas', () => {
    expect(ehEtapaQualificado('Qualificação')).toBe(false)
    expect(ehEtapaQualificado('Desqualificado')).toBe(false)
    expect(ehEtapaQualificado('Abordado')).toBe(false)
  })
})

describe('PRAZOS_FOLLOWUP_HORAS', () => {
  it('tem os prazos crescentes 48h/72h/5d/7d/14d e 14d no nível final', () => {
    expect(PRAZOS_FOLLOWUP_HORAS).toEqual({ 1: 48, 2: 72, 3: 120, 4: 168, 5: 336, 6: 336 })
  })
})

describe('pendenciaFollowup', () => {
  const agora = new Date('2026-07-19T12:00:00Z')

  /** Base de params: lead aberto em Contato Feito, ainda fora do fluxo. */
  function emContatoFeito(baseHorasAtras: number) {
    return {
      status: 'aberta',
      etapaNome: 'Contato Feito',
      followupNivel: null,
      ultimoFollowupEm: null,
      baseContatoFeito: horasAtras(agora, baseHorasAtras),
    }
  }

  /** Base de params: lead aberto na etapa Follow-up no nível dado. */
  function emFollowup(nivel: number, ultimoHorasAtras: number) {
    return {
      status: 'aberta',
      etapaNome: 'Follow-up',
      followupNivel: nivel,
      ultimoFollowupEm: horasAtras(agora, ultimoHorasAtras),
      baseContatoFeito: null,
    }
  }

  it('em Contato Feito com menos de 24h de base → sem pendência', () => {
    expect(pendenciaFollowup(emContatoFeito(23), agora)).toBeNull()
  })

  it('em Contato Feito com 24h em ponto → pendente (limite conta como vencido)', () => {
    expect(pendenciaFollowup(emContatoFeito(24), agora)).toEqual({
      tipo: 'pendente',
      texto: 'Follow-up pendente',
    })
  })

  it('nível 1 há 47h → sem pendência; há 48h → pendente', () => {
    expect(pendenciaFollowup(emFollowup(1, 47), agora)).toBeNull()
    expect(pendenciaFollowup(emFollowup(1, 48), agora)).toEqual({
      tipo: 'pendente',
      texto: 'Follow-up pendente',
    })
  })

  it('nível 3 há 119h → sem pendência; há 120h (5d) → pendente', () => {
    expect(pendenciaFollowup(emFollowup(3, 119), agora)).toBeNull()
    expect(pendenciaFollowup(emFollowup(3, 120), agora)).toEqual({
      tipo: 'pendente',
      texto: 'Follow-up pendente',
    })
  })

  it('nível 4 há 168h (7d) → pendente', () => {
    expect(pendenciaFollowup(emFollowup(4, 168), agora)).toEqual({
      tipo: 'pendente',
      texto: 'Follow-up pendente',
    })
  })

  it('nível 5 há 335h → sem pendência; há 336h (14d) → pendente', () => {
    expect(pendenciaFollowup(emFollowup(5, 335), agora)).toBeNull()
    expect(pendenciaFollowup(emFollowup(5, 336), agora)).toEqual({
      tipo: 'pendente',
      texto: 'Follow-up pendente',
    })
  })

  it('nível 6 há 14d em ponto → esgotado; antes de 14d → sem pendência', () => {
    expect(pendenciaFollowup(emFollowup(6, 336), agora)).toEqual({
      tipo: 'esgotado',
      texto: 'Follow-ups esgotados',
    })
    expect(pendenciaFollowup(emFollowup(6, 335), agora)).toBeNull()
  })

  it('status diferente de aberta nunca pende (ganho/perdido)', () => {
    expect(
      pendenciaFollowup({ ...emFollowup(6, 400), status: 'ganha' }, agora),
    ).toBeNull()
    expect(
      pendenciaFollowup({ ...emContatoFeito(100), status: 'perdida' }, agora),
    ).toBeNull()
  })

  it('etapa fora do fluxo (Qualificado) não pende mesmo com nível gravado (histórico)', () => {
    expect(
      pendenciaFollowup(
        {
          status: 'aberta',
          etapaNome: 'Qualificado',
          followupNivel: 3,
          ultimoFollowupEm: horasAtras(agora, 500),
          baseContatoFeito: null,
        },
        agora,
      ),
    ).toBeNull()
  })

  it('aceita datas em string ISO', () => {
    expect(
      pendenciaFollowup(
        {
          status: 'aberta',
          etapaNome: 'Follow-up',
          followupNivel: 1,
          ultimoFollowupEm: horasAtras(agora, 48).toISOString(),
          baseContatoFeito: null,
        },
        agora,
      ),
    ).toEqual({ tipo: 'pendente', texto: 'Follow-up pendente' })
  })

  it('em Contato Feito sem base conhecida → sem pendência (não inventa prazo)', () => {
    expect(
      pendenciaFollowup(
        {
          status: 'aberta',
          etapaNome: 'Contato Feito',
          followupNivel: null,
          ultimoFollowupEm: null,
          baseContatoFeito: null,
        },
        agora,
      ),
    ).toBeNull()
  })

  // --- Funil FRIO (pipelineFrio=true): "Abordado" acumula entrada + cadência ---
  describe('no funil Frio (pipelineFrio=true, cadência em "Abordado")', () => {
    /** Card frio em "Abordado" com nível null: entrada de 24h desde a base. */
    function frioEntrada(baseHorasAtras: number) {
      return {
        status: 'aberta',
        etapaNome: 'Abordado',
        followupNivel: null,
        ultimoFollowupEm: null,
        baseContatoFeito: horasAtras(agora, baseHorasAtras),
      }
    }

    /** Card frio em "Abordado" já na cadência no nível dado. */
    function frioCadencia(nivel: number, ultimoHorasAtras: number) {
      return {
        status: 'aberta',
        etapaNome: 'Abordado',
        followupNivel: nivel,
        ultimoFollowupEm: horasAtras(agora, ultimoHorasAtras),
        baseContatoFeito: null,
      }
    }

    it('nível null: 23h → sem pendência; 24h → pendente (entrada)', () => {
      expect(pendenciaFollowup(frioEntrada(23), agora, true)).toBeNull()
      expect(pendenciaFollowup(frioEntrada(24), agora, true)).toEqual({
        tipo: 'pendente',
        texto: 'Follow-up pendente',
      })
    })

    it('nível 1: 47h → sem pendência; 48h → pendente (cadência)', () => {
      expect(pendenciaFollowup(frioCadencia(1, 47), agora, true)).toBeNull()
      expect(pendenciaFollowup(frioCadencia(1, 48), agora, true)).toEqual({
        tipo: 'pendente',
        texto: 'Follow-up pendente',
      })
    })

    it('nível 6 há 336h (14d) → esgotado', () => {
      expect(pendenciaFollowup(frioCadencia(6, 336), agora, true)).toEqual({
        tipo: 'esgotado',
        texto: 'Follow-ups esgotados',
      })
    })

    it('status ganha/perdida no frio nunca pende', () => {
      expect(pendenciaFollowup({ ...frioCadencia(6, 400), status: 'ganha' }, agora, true)).toBeNull()
      expect(pendenciaFollowup({ ...frioEntrada(100), status: 'perdida' }, agora, true)).toBeNull()
    })

    it('etapa "A Abordar" no frio (nível null) não pende — só "Abordado" dispara', () => {
      expect(
        pendenciaFollowup({ ...frioEntrada(100), etapaNome: 'A Abordar' }, agora, true),
      ).toBeNull()
    })

    it('regressão: SEM pipelineFrio, "Abordado" não dispara nada (é etapa do Vendas)', () => {
      expect(pendenciaFollowup(frioEntrada(100), agora)).toBeNull()
      expect(pendenciaFollowup(frioCadencia(1, 400), agora)).toBeNull()
    })
  })
})
