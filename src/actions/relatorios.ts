'use server'

import { eq, and, desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, adAccounts } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { gerarRelatorioCliente, type RelatorioGerado } from '@/lib/relatorios/gerar-relatorio'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'

export type ClienteParaRelatorio = {
  id: string
  nome: string
  nicho: string
  objetivoPrincipal: string | null
  totalContas: number
}

/**
 * Lista clientes que possuem contas Meta ativas (candidatos a relatório).
 */
export async function listarClientesRelatorio(): Promise<ClienteParaRelatorio[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const rows = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      nicho: clientes.nicho,
      objetivoPrincipal: clientes.objetivoPrincipal,
    })
    .from(clientes)
    .where(eq(clientes.status, 'ativo'))
    .orderBy(clientes.nome)

  // Contar contas ativas por cliente
  const resultado: ClienteParaRelatorio[] = []
  for (const row of rows) {
    const contas = await db
      .select({ id: adAccounts.id })
      .from(adAccounts)
      .where(
        and(
          eq(adAccounts.clienteId, row.id),
          eq(adAccounts.plataforma, 'meta'),
          eq(adAccounts.ativo, true),
        ),
      )

    if (contas.length > 0) {
      resultado.push({
        ...row,
        totalContas: contas.length,
      })
    }
  }

  return resultado
}

/**
 * Gera relatório semanal (últimos 7 dias) para um cliente.
 */
export async function gerarRelatorio(
  clienteId: string,
  dataInicio?: string,
  dataFim?: string,
): Promise<{ success: true; relatorio: RelatorioGerado } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  try {
    const relatorio = await gerarRelatorioCliente(clienteId, dataInicio, dataFim)
    if (!relatorio) {
      return { success: false, error: 'Sem dados para este cliente no período selecionado' }
    }
    return { success: true, relatorio }
  } catch (err) {
    console.error('[Relatórios] Erro ao gerar:', err)
    return { success: false, error: 'Erro interno ao gerar relatório' }
  }
}

/**
 * Gera relatórios de TODOS os clientes ativos (para a geração em lote da segunda-feira).
 */
export async function gerarRelatoriosEmLote(
  dataInicio?: string,
  dataFim?: string,
): Promise<{ gerados: RelatorioGerado[]; erros: { clienteId: string; clienteNome: string; error: string }[] }> {
  const user = await getCurrentUser()
  if (!user) return { gerados: [], erros: [] }

  const clientesList = await listarClientesRelatorio()
  const gerados: RelatorioGerado[] = []
  const erros: { clienteId: string; clienteNome: string; error: string }[] = []

  for (const cliente of clientesList) {
    try {
      const relatorio = await gerarRelatorioCliente(cliente.id, dataInicio, dataFim)
      if (relatorio) {
        gerados.push(relatorio)
      } else {
        erros.push({ clienteId: cliente.id, clienteNome: cliente.nome, error: 'Sem dados no período' })
      }
    } catch (err) {
      erros.push({ clienteId: cliente.id, clienteNome: cliente.nome, error: 'Erro ao gerar' })
    }
  }

  return { gerados, erros }
}
