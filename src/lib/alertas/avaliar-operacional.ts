// Avaliadores PUROS dos alertas OPERACIONAIS internos (quick 260717-qq6):
//   1. Régua de inadimplência interna sobre `cobrancas` (vencendo/vencida)
//   2. Contrato parado em aguardando_assinatura há mais de 3 dias
//   3. SLA de 1º contato de lead aberto no CRM (24h)
//
// Mesmo desenho de avaliar.ts: recebem ROWS já buscadas (quem consulta o banco
// é calcular.ts, com queries SEQUENCIAIS), retornam Alerta[] com id = chave de
// dedup ESTÁVEL — o ciclo de vida (dedup/reabertura/resolução automática) é o
// de persistir.ts, sem mudança nenhuma lá.

import { differenceInCalendarDays, parseISO } from 'date-fns'

import { SLA_PRIMEIRO_CONTATO_HORAS, estourouSla, horasAguardando } from '@/lib/crm/sla-contato'
import type { Alerta, SeveridadeAlerta } from './types'

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// --- 1. Cobranças (régua de inadimplência interna) ---

export type CobrancaInput = {
  id: string
  clienteId: string
  clienteNome: string
  valor: string | number
  status: string // 'pendente' | 'paga' | 'vencida' | 'cancelada'
  vencimento: string // YYYY-MM-DD
}

/** Antecedência (em dias) para avisar de fatura pendente vencendo. */
export const DIAS_AVISO_FATURA = 3

/**
 * Fatura pendente vencendo em até 3 dias → 'fatura_vencendo' (0-1 dia = crítico);
 * fatura vencida (status 'vencida' OU pendente com vencimento no passado) →
 * 'fatura_vencida' crítico. Chaves DISTINTAS de propósito: quando a fatura vira
 * vencida, o alerta de "vencendo" resolve sozinho e o de "vencida" abre.
 */
export function avaliarCobrancas(cobrancas: CobrancaInput[], hoje: Date = new Date()): Alerta[] {
  const alertas: Alerta[] = []

  for (const c of cobrancas) {
    if (c.status === 'paga' || c.status === 'cancelada') continue

    const valor = typeof c.valor === 'string' ? Number(c.valor) : c.valor
    const dias = differenceInCalendarDays(parseISO(c.vencimento), hoje)

    const vencida = c.status === 'vencida' || (c.status === 'pendente' && dias < 0)

    if (vencida) {
      const atraso = Math.max(1, -dias)
      alertas.push({
        id: `fatura-vencida-${c.id}`,
        tipo: 'fatura_vencida',
        severidade: 'critico',
        titulo: 'Fatura vencida',
        detalhe: `Fatura de ${formatarMoeda(valor)} em atraso há ${atraso} dia${atraso !== 1 ? 's' : ''}`,
        clienteNome: c.clienteNome,
        clienteId: c.clienteId,
        dataRelevante: c.vencimento,
      })
      continue
    }

    if (c.status !== 'pendente' || dias > DIAS_AVISO_FATURA) continue

    const severidade: SeveridadeAlerta = dias <= 1 ? 'critico' : 'atencao'
    const titulo = dias === 0 ? 'Fatura vence hoje' : `Fatura vence em ${dias} dia${dias !== 1 ? 's' : ''}`

    alertas.push({
      id: `fatura-vencendo-${c.id}`,
      tipo: 'fatura_vencendo',
      severidade,
      titulo,
      detalhe: `Fatura de ${formatarMoeda(valor)} vence em ${c.vencimento.split('-').reverse().join('/')}`,
      clienteNome: c.clienteNome,
      clienteId: c.clienteId,
      dataRelevante: c.vencimento,
    })
  }

  return alertas
}

// --- 2. Contrato aguardando assinatura ---

export type ContratoAssinaturaInput = {
  id: string
  clienteId: string
  clienteNome: string
  statusFluxo: string | null
  enviadoParaAssinaturaEm: Date | null
  createdAt: Date
}

/** Dias parados em aguardando_assinatura antes de alertar. */
export const DIAS_LIMITE_ASSINATURA = 3

/**
 * Contrato em 'aguardando_assinatura' há MAIS de 3 dias → 'assinatura_pendente'
 * (atenção). Base do relógio: enviadoParaAssinaturaEm; fallback createdAt para
 * linhas antigas sem o timestamp.
 */
export function avaliarAssinaturaPendente(
  contratos: ContratoAssinaturaInput[],
  agora: Date = new Date(),
): Alerta[] {
  const alertas: Alerta[] = []

  for (const c of contratos) {
    if (c.statusFluxo !== 'aguardando_assinatura') continue

    const base = c.enviadoParaAssinaturaEm ?? c.createdAt
    const dias = Math.floor((agora.getTime() - base.getTime()) / (24 * 60 * 60 * 1000))
    if (dias <= DIAS_LIMITE_ASSINATURA) continue

    alertas.push({
      id: `assinatura-${c.id}`,
      tipo: 'assinatura_pendente',
      severidade: 'atencao',
      titulo: 'Contrato aguardando assinatura',
      detalhe: `Enviado para assinatura há ${dias} dias sem retorno — vale um lembrete ao cliente`,
      clienteNome: c.clienteNome,
      clienteId: c.clienteId,
      dataRelevante: base.toISOString().slice(0, 10),
    })
  }

  return alertas
}

// --- 3. SLA de 1º contato (CRM) ---

export type OportunidadeSlaInput = {
  id: string
  titulo: string
  contatoNome: string | null
  status: string // 'aberta' | 'ganha' | 'perdida'
  criadaEm: Date
  primeiroContatoEm: Date | null
}

/**
 * Lead ABERTO sem primeiro_contato_em e criado há 24h ou mais →
 * 'sla_primeiro_contato' (atenção). clienteNome = nome do contato (fallback
 * título do negócio); clienteId vazio — lead ainda não é cliente.
 */
export function avaliarSlaPrimeiroContato(
  oportunidades: OportunidadeSlaInput[],
  agora: Date = new Date(),
): Alerta[] {
  const alertas: Alerta[] = []

  for (const o of oportunidades) {
    if (o.status !== 'aberta') continue
    if (o.primeiroContatoEm !== null) continue
    if (!estourouSla(o.criadaEm, agora)) continue

    const horas = Math.floor(horasAguardando(o.criadaEm, agora))

    alertas.push({
      id: `sla-contato-${o.id}`,
      tipo: 'sla_primeiro_contato',
      severidade: 'atencao',
      titulo: `Lead sem 1º contato há ${horas}h`,
      detalhe: `SLA de ${SLA_PRIMEIRO_CONTATO_HORAS}h estourado — fazer o 1º contato agora`,
      clienteNome: o.contatoNome ?? o.titulo,
      clienteId: '',
      dataRelevante: o.criadaEm.toISOString().slice(0, 10),
    })
  }

  return alertas
}
