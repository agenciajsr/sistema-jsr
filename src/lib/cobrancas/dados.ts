// Leitura das faturas (tabela cobrancas) — fonte da aba "Faturas" da ficha do
// cliente. Módulo server comum (NÃO 'use server'). Nome getFaturasDoCliente
// para não colidir com getCobrancasDoCliente de @/actions/financeiro (que lê
// TRANSACOES — livro-caixa, outra semântica).

import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, cobrancas, contratos } from '@/lib/db/schema'
import { hojeBrasilia } from '@/lib/date-br'
import { competenciaDe, contratoElegivel } from '@/lib/cobrancas/regras'

export type FaturaCliente = {
  id: string
  competencia: string
  valor: string
  status: string
  vencimento: string
  invoiceUrl: string | null
  formaQuitacao: string | null
  pagoEm: Date | null
  criadoVia: string
}

export type LinhaVisaoCobrancas = {
  clienteId: string
  nome: string
  modo: string
  asaasCustomerId: string | null
  temContratoVigente: boolean
  contratoId: string | null
  fatura: {
    id: string
    status: string
    valor: string
    vencimento: string
    invoiceUrl: string | null
  } | null
}

/**
 * Visão consolidada da aba "Cobranças" em /financeiro: todos os clientes
 * ativos/aguardando_inicio/em_aviso com o modo de cobrança, o contrato
 * vigente e a fatura da competência corrente. Poucas queries AGREGADAS
 * SEQUENCIAIS (pool pequeno — nunca Promise.all interno) + merge em memória.
 */
export async function getVisaoCobrancas(): Promise<LinhaVisaoCobrancas[]> {
  const hoje = hojeBrasilia()
  const competencia = competenciaDe(hoje)

  // (1) Clientes da carteira ativa.
  const listaClientes = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      modoCobranca: clientes.modoCobranca,
      asaasCustomerId: clientes.asaasCustomerId,
    })
    .from(clientes)
    .where(inArray(clientes.status, ['ativo', 'aguardando_inicio', 'em_aviso']))

  if (listaClientes.length === 0) return []
  const ids = listaClientes.map((c) => c.id)

  // (2) Contratos assinados desses clientes (vigência decidida em memória).
  const assinados = await db
    .select({
      id: contratos.id,
      clienteId: contratos.clienteId,
      dataInicio: contratos.dataInicio,
      dataVencimento: contratos.dataVencimento,
      statusFluxo: contratos.statusFluxo,
    })
    .from(contratos)
    .where(and(inArray(contratos.clienteId, ids), eq(contratos.statusFluxo, 'assinado')))

  // (3) Faturas da competência corrente desses clientes.
  const faturasDoMes = await db
    .select({
      id: cobrancas.id,
      clienteId: cobrancas.clienteId,
      status: cobrancas.status,
      valor: cobrancas.valor,
      vencimento: cobrancas.vencimento,
      invoiceUrl: cobrancas.invoiceUrl,
    })
    .from(cobrancas)
    .where(and(inArray(cobrancas.clienteId, ids), eq(cobrancas.competencia, competencia)))

  return listaClientes
    .map((cliente) => {
      const vigente = assinados.find(
        (c) => c.clienteId === cliente.id && contratoElegivel(c, hoje),
      )
      const doCliente = faturasDoMes.filter((f) => f.clienteId === cliente.id)
      // Prioriza a fatura em aberto; senão a paga; senão a primeira que houver.
      const fatura =
        doCliente.find((f) => f.status === 'pendente' || f.status === 'vencida') ??
        doCliente.find((f) => f.status === 'paga') ??
        doCliente[0] ??
        null
      return {
        clienteId: cliente.id,
        nome: cliente.nome,
        modo: cliente.modoCobranca,
        asaasCustomerId: cliente.asaasCustomerId,
        temContratoVigente: Boolean(vigente),
        contratoId: vigente?.id ?? null,
        fatura: fatura
          ? {
              id: fatura.id,
              status: fatura.status,
              valor: fatura.valor,
              vencimento: fatura.vencimento,
              invoiceUrl: fatura.invoiceUrl,
            }
          : null,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function getFaturasDoCliente(clienteId: string): Promise<FaturaCliente[]> {
  const linhas = await db
    .select({
      id: cobrancas.id,
      competencia: cobrancas.competencia,
      valor: cobrancas.valor,
      status: cobrancas.status,
      vencimento: cobrancas.vencimento,
      invoiceUrl: cobrancas.invoiceUrl,
      formaQuitacao: cobrancas.formaQuitacao,
      pagoEm: cobrancas.pagoEm,
      criadoVia: cobrancas.criadoVia,
    })
    .from(cobrancas)
    .where(eq(cobrancas.clienteId, clienteId))
    .orderBy(desc(cobrancas.vencimento))

  return linhas
}
