import { describe, expect, it } from 'vitest'

import {
  avaliarAssinaturaPendente,
  avaliarCobrancas,
  avaliarSlaPrimeiroContato,
  avaliarOnboardingParado,
  avaliarRiscoChurn,
  type CobrancaInput,
  type ContratoAssinaturaInput,
  type OportunidadeSlaInput,
  type OnboardingInput,
  type RiscoChurnInput,
} from './avaliar-operacional'

const HOJE = new Date('2026-07-17T12:00:00-03:00')

function cobranca(extra: Partial<CobrancaInput>): CobrancaInput {
  return {
    id: 'cob-1',
    clienteId: 'cli-1',
    clienteNome: 'Cliente Teste',
    valor: '1500.00',
    status: 'pendente',
    vencimento: '2026-07-20',
    ...extra,
  }
}

describe('avaliarCobrancas', () => {
  it('pendente vencendo em 3 dias → fatura_vencendo com atencao', () => {
    const alertas = avaliarCobrancas([cobranca({ vencimento: '2026-07-20' })], HOJE)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('fatura_vencendo')
    expect(alertas[0].severidade).toBe('atencao')
    expect(alertas[0].id).toBe('fatura-vencendo-cob-1')
  })

  it('pendente vencendo em 1 dia ou hoje → critico', () => {
    const amanha = avaliarCobrancas([cobranca({ vencimento: '2026-07-18' })], HOJE)
    expect(amanha[0].severidade).toBe('critico')

    const hoje = avaliarCobrancas([cobranca({ vencimento: '2026-07-17' })], HOJE)
    expect(hoje[0].severidade).toBe('critico')
    expect(hoje[0].titulo).toBe('Fatura vence hoje')
  })

  it('pendente vencendo em 5 dias → nada', () => {
    expect(avaliarCobrancas([cobranca({ vencimento: '2026-07-22' })], HOJE)).toHaveLength(0)
  })

  it('status vencida → fatura_vencida critico com dias de atraso e valor pt-BR', () => {
    const alertas = avaliarCobrancas(
      [cobranca({ status: 'vencida', vencimento: '2026-07-10' })],
      HOJE,
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('fatura_vencida')
    expect(alertas[0].severidade).toBe('critico')
    expect(alertas[0].id).toBe('fatura-vencida-cob-1')
    expect(alertas[0].detalhe).toContain('em atraso há 7 dias')
    expect(alertas[0].detalhe).toContain('1.500,00')
  })

  it('pendente com vencimento no passado tambem vira fatura_vencida', () => {
    const alertas = avaliarCobrancas(
      [cobranca({ status: 'pendente', vencimento: '2026-07-15' })],
      HOJE,
    )
    expect(alertas[0].tipo).toBe('fatura_vencida')
  })

  it('paga e cancelada → nada', () => {
    const alertas = avaliarCobrancas(
      [
        cobranca({ status: 'paga', vencimento: '2026-07-10' }),
        cobranca({ id: 'cob-2', status: 'cancelada', vencimento: '2026-07-17' }),
      ],
      HOJE,
    )
    expect(alertas).toHaveLength(0)
  })

  it('chaves vencendo/vencida sao DISTINTAS (uma resolve, a outra abre)', () => {
    const vencendo = avaliarCobrancas([cobranca({ vencimento: '2026-07-18' })], HOJE)
    const vencida = avaliarCobrancas([cobranca({ status: 'vencida', vencimento: '2026-07-18' })],
      new Date('2026-07-19T12:00:00-03:00'))
    expect(vencendo[0].id).not.toBe(vencida[0].id)
  })
})

function contrato(extra: Partial<ContratoAssinaturaInput>): ContratoAssinaturaInput {
  return {
    id: 'con-1',
    clienteId: 'cli-1',
    clienteNome: 'Cliente Teste',
    statusFluxo: 'aguardando_assinatura',
    enviadoParaAssinaturaEm: new Date('2026-07-10T12:00:00-03:00'),
    createdAt: new Date('2026-07-01T12:00:00-03:00'),
    ...extra,
  }
}

describe('avaliarAssinaturaPendente', () => {
  it('aguardando_assinatura ha mais de 3 dias → assinatura_pendente com dias no detalhe', () => {
    const alertas = avaliarAssinaturaPendente([contrato({})], HOJE)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('assinatura_pendente')
    expect(alertas[0].severidade).toBe('atencao')
    expect(alertas[0].id).toBe('assinatura-con-1')
    expect(alertas[0].detalhe).toContain('há 7 dias')
  })

  it('ate 3 dias → nada', () => {
    const alertas = avaliarAssinaturaPendente(
      [contrato({ enviadoParaAssinaturaEm: new Date('2026-07-15T12:00:00-03:00') })],
      HOJE,
    )
    expect(alertas).toHaveLength(0)
  })

  it('outro statusFluxo → nada', () => {
    expect(avaliarAssinaturaPendente([contrato({ statusFluxo: 'assinado' })], HOJE)).toHaveLength(0)
    expect(avaliarAssinaturaPendente([contrato({ statusFluxo: null })], HOJE)).toHaveLength(0)
  })

  it('enviadoParaAssinaturaEm null usa createdAt como fallback', () => {
    const alertas = avaliarAssinaturaPendente(
      [contrato({ enviadoParaAssinaturaEm: null })],
      HOJE,
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0].detalhe).toContain('há 16 dias')
  })
})

function oportunidade(extra: Partial<OportunidadeSlaInput>): OportunidadeSlaInput {
  return {
    id: 'op-1',
    titulo: 'Trafego Pago - Loja X',
    contatoNome: 'Maria Lead',
    status: 'aberta',
    criadaEm: new Date('2026-07-15T12:00:00-03:00'),
    primeiroContatoEm: null,
    pipelineNome: 'Vendas',
    ...extra,
  }
}

describe('avaliarSlaPrimeiroContato', () => {
  it('aberta sem 1º contato ha mais de 1h → sla_primeiro_contato', () => {
    const alertas = avaliarSlaPrimeiroContato([oportunidade({})], HOJE)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('sla_primeiro_contato')
    expect(alertas[0].severidade).toBe('atencao')
    expect(alertas[0].id).toBe('sla-contato-op-1')
    expect(alertas[0].clienteNome).toBe('Maria Lead')
    expect(alertas[0].titulo).toContain('48h')
  })

  it('com primeiroContatoEm preenchido → nada', () => {
    const alertas = avaliarSlaPrimeiroContato(
      [oportunidade({ primeiroContatoEm: new Date('2026-07-15T13:00:00-03:00') })],
      HOJE,
    )
    expect(alertas).toHaveLength(0)
  })

  it('criada ha menos de 1h → nada', () => {
    const alertas = avaliarSlaPrimeiroContato(
      [oportunidade({ criadaEm: new Date('2026-07-17T11:30:00-03:00') })],
      HOJE,
    )
    expect(alertas).toHaveLength(0)
  })

  it('status ganha/perdida → nada', () => {
    expect(avaliarSlaPrimeiroContato([oportunidade({ status: 'ganha' })], HOJE)).toHaveLength(0)
    expect(avaliarSlaPrimeiroContato([oportunidade({ status: 'perdida' })], HOJE)).toHaveLength(0)
  })

  it('sem nome de contato usa o titulo do negocio', () => {
    const alertas = avaliarSlaPrimeiroContato([oportunidade({ contatoNome: null })], HOJE)
    expect(alertas[0].clienteNome).toBe('Trafego Pago - Loja X')
  })

  it('pipeline Prospecção Fria estourado → 0 alertas (frio não tem SLA de 1º contato)', () => {
    const alertas = avaliarSlaPrimeiroContato(
      [oportunidade({ pipelineNome: 'Prospecção Fria' })],
      HOJE,
    )
    expect(alertas).toHaveLength(0)
  })
})

function onboarding(extra: Partial<OnboardingInput>): OnboardingInput {
  return {
    clienteId: 'cli-1',
    clienteNome: 'Cliente Teste',
    pendentes: 3,
    iniciadoEm: new Date('2026-07-01T12:00:00-03:00'),
    ...extra,
  }
}

describe('avaliarOnboardingParado', () => {
  it('pendentes ha mais de 7 dias → onboarding_parado', () => {
    const alertas = avaliarOnboardingParado([onboarding({})], HOJE)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('onboarding_parado')
    expect(alertas[0].severidade).toBe('atencao')
    expect(alertas[0].id).toBe('onboarding-cli-1')
    expect(alertas[0].detalhe).toContain('3 itens')
  })

  it('sem pendentes → nada', () => {
    expect(avaliarOnboardingParado([onboarding({ pendentes: 0 })], HOJE)).toHaveLength(0)
  })

  it('iniciado ha menos de 7 dias → nada', () => {
    const alertas = avaliarOnboardingParado(
      [onboarding({ iniciadoEm: new Date('2026-07-14T12:00:00-03:00') })],
      HOJE,
    )
    expect(alertas).toHaveLength(0)
  })

  it('singular: 1 item pendente', () => {
    const alertas = avaliarOnboardingParado([onboarding({ pendentes: 1 })], HOJE)
    expect(alertas[0].detalhe).toContain('1 item pendente')
  })
})

function riscoChurn(extra: Partial<RiscoChurnInput>): RiscoChurnInput {
  return {
    clienteId: 'cli-1',
    clienteNome: 'Cliente Teste',
    status: 'ativo',
    faturasVencidas: 1,
    ...extra,
  }
}

describe('avaliarRiscoChurn', () => {
  it('cliente ativo com fatura vencida → risco_churn', () => {
    const alertas = avaliarRiscoChurn([riscoChurn({})])
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('risco_churn')
    expect(alertas[0].severidade).toBe('atencao')
    expect(alertas[0].id).toBe('risco-churn-cli-1')
  })

  it('cliente ja em_aviso → nada (ja esta em gestao de crise)', () => {
    expect(avaliarRiscoChurn([riscoChurn({ status: 'em_aviso' })])).toHaveLength(0)
  })

  it('sem fatura vencida → nada', () => {
    expect(avaliarRiscoChurn([riscoChurn({ faturasVencidas: 0 })])).toHaveLength(0)
  })

  it('plural: 2 faturas vencidas', () => {
    const alertas = avaliarRiscoChurn([riscoChurn({ faturasVencidas: 2 })])
    expect(alertas[0].detalhe).toContain('2 faturas vencidas')
  })
})
