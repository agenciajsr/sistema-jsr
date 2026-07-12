import { differenceInDays, parseISO } from 'date-fns'

import type { Alerta, SeveridadeAlerta } from './types'
import { SEVERIDADE_ORDEM } from './types'

// --- Helpers ---

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// --- Contratos ---

type ContratoInput = {
  id: string
  clienteId: string
  clienteNome: string
  dataVencimento: string
  valorMensal: string | number
}

export function avaliarContratos(contratos: ContratoInput[]): Alerta[] {
  const hoje = new Date()
  const alertas: Alerta[] = []

  for (const c of contratos) {
    const vencimento = parseISO(c.dataVencimento)
    const dias = differenceInDays(vencimento, hoje)
    const valor = typeof c.valorMensal === 'string' ? Number(c.valorMensal) : c.valorMensal

    let severidade: SeveridadeAlerta
    let titulo: string

    if (dias < 0) {
      // Ja vencido
      severidade = 'critico'
      titulo = 'Contrato vencido'
    } else if (dias <= 7) {
      severidade = 'critico'
      titulo = `Contrato vence em ${dias} dia${dias !== 1 ? 's' : ''}`
    } else if (dias <= 15) {
      severidade = 'atencao'
      titulo = `Contrato vence em ${dias} dias`
    } else if (dias <= 30) {
      severidade = 'info'
      titulo = `Contrato vence em ${dias} dias`
    } else {
      // Mais de 30 dias — ignorar
      continue
    }

    const detalhe =
      dias < 0
        ? `Venceu ha ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''} — MRR em risco: ${formatarMoeda(valor)}`
        : `Vence em ${dias} dia${dias !== 1 ? 's' : ''} — MRR em risco: ${formatarMoeda(valor)}`

    alertas.push({
      id: `contrato-${c.id}`,
      tipo: 'contrato_vencendo',
      severidade,
      titulo,
      detalhe,
      clienteNome: c.clienteNome,
      clienteId: c.clienteId,
      dataRelevante: c.dataVencimento,
    })
  }

  return alertas
}

// --- Transacoes ---

type TransacaoInput = {
  id: string
  clienteId: string | null
  clienteNome: string | null
  descricao: string
  valor: string | number
  data: string
  status: string
}

const THRESHOLD_CRITICO_TRANSACAO = 1000

export function avaliarTransacoes(transacoes: TransacaoInput[]): Alerta[] {
  const alertas: Alerta[] = []

  for (const t of transacoes) {
    if (t.status !== 'vencido') continue

    const valor = typeof t.valor === 'string' ? Number(t.valor) : t.valor
    const severidade: SeveridadeAlerta = valor >= THRESHOLD_CRITICO_TRANSACAO ? 'critico' : 'atencao'

    alertas.push({
      id: `transacao-${t.id}`,
      tipo: 'pagamento_vencido',
      severidade,
      titulo: 'Pagamento vencido',
      detalhe: `${formatarMoeda(valor)} — ${t.descricao}`,
      clienteNome: t.clienteNome ?? 'Sem cliente',
      clienteId: t.clienteId ?? '',
      dataRelevante: t.data,
    })
  }

  return alertas
}

// --- Clientes inativos ---

type ClienteInput = {
  id: string
  nome: string
  status: string
}

export function avaliarClientesInativos(clientes: ClienteInput[]): Alerta[] {
  const alertas: Alerta[] = []
  const hoje = new Date().toISOString().slice(0, 10)

  for (const c of clientes) {
    if (c.status !== 'pausado' && c.status !== 'encerrado') continue

    alertas.push({
      id: `cliente-${c.id}`,
      tipo: 'cliente_inativo',
      severidade: 'info',
      titulo: `Cliente ${c.status}`,
      detalhe: 'Sem atividade — verificar situacao',
      clienteNome: c.nome,
      clienteId: c.id,
      dataRelevante: hoje,
    })
  }

  return alertas
}

// --- Saldo de contas de anuncio ---

type ContaAnuncioInput = {
  id: string
  nome: string
  clienteId: string | null
  clienteNome: string | null
  saldo: string | number | null
}

const THRESHOLD_CRITICO_SALDO = 50
const THRESHOLD_ATENCAO_SALDO = 100

export function avaliarSaldoContas(contas: ContaAnuncioInput[]): Alerta[] {
  const alertas: Alerta[] = []
  const hoje = new Date().toISOString().slice(0, 10)

  for (const conta of contas) {
    if (conta.saldo === null || conta.saldo === undefined) continue

    const saldo = typeof conta.saldo === 'string' ? Number(conta.saldo) : conta.saldo
    if (isNaN(saldo)) continue

    let severidade: SeveridadeAlerta
    let titulo: string

    if (saldo < THRESHOLD_CRITICO_SALDO) {
      severidade = 'critico'
      titulo = 'Verba quase zerada'
    } else if (saldo < THRESHOLD_ATENCAO_SALDO) {
      severidade = 'atencao'
      titulo = 'Verba baixa'
    } else {
      continue
    }

    alertas.push({
      id: `verba-${conta.id}`,
      tipo: 'verba_baixa',
      severidade,
      titulo,
      detalhe: `Conta "${conta.nome}" com saldo de ${formatarMoeda(saldo)}`,
      clienteNome: conta.clienteNome ?? 'Sem cliente',
      clienteId: conta.clienteId ?? '',
      dataRelevante: hoje,
    })
  }

  return alertas
}

// --- Ordenacao ---

export function ordenarPorSeveridade(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort((a, b) => SEVERIDADE_ORDEM[a.severidade] - SEVERIDADE_ORDEM[b.severidade])
}
