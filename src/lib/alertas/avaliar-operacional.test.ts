import { describe, expect, it } from 'vitest'

import {
  avaliarAssinaturaPendente,
  avaliarCobrancas,
  avaliarSlaPrimeiroContato,
  type CobrancaInput,
  type ContratoAssinaturaInput,
  type OportunidadeSlaInput,
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
    ...extra,
  }
}

describe('avaliarSlaPrimeiroContato', () => {
  it('aberta sem 1º contato ha mais de 24h → sla_primeiro_contato', () => {
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

  it('criada ha menos de 24h → nada', () => {
    const alertas = avaliarSlaPrimeiroContato(
      [oportunidade({ criadaEm: new Date('2026-07-17T00:00:00-03:00') })],
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
})
