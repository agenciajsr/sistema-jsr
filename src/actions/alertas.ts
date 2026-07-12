'use server'

import { eq, lte } from 'drizzle-orm'
import { addDays, format } from 'date-fns'

import { db } from '@/lib/db'
import { contratos, transacoes, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import {
  avaliarContratos,
  avaliarTransacoes,
  avaliarClientesInativos,
  ordenarPorSeveridade,
} from '@/lib/alertas/avaliar'
import type { Alerta } from '@/lib/alertas/types'

export async function getAlertas(): Promise<Alerta[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const hoje = new Date()
  const limite30d = format(addDays(hoje, 30), 'yyyy-MM-dd')

  // 1. Contratos a vencer (inclui ja vencidos — sem lower bound)
  const contratosRows = await db
    .select({
      id: contratos.id,
      clienteId: contratos.clienteId,
      clienteNome: clientes.nome,
      dataVencimento: contratos.dataVencimento,
      valorMensal: contratos.valorMensal,
    })
    .from(contratos)
    .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
    .where(lte(contratos.dataVencimento, limite30d))

  // 2. Transacoes vencidas
  const transacoesRows = await db
    .select({
      id: transacoes.id,
      clienteId: transacoes.clienteId,
      clienteNome: clientes.nome,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      status: transacoes.status,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .where(eq(transacoes.status, 'vencido'))

  // 3. Clientes inativos
  const clientesRows = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      status: clientes.status,
    })
    .from(clientes)
    .where(
      eq(clientes.status, 'pausado'),
    )

  // Buscar encerrados separadamente (drizzle nao suporta IN com pgEnum facilmente)
  const clientesEncerrados = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      status: clientes.status,
    })
    .from(clientes)
    .where(
      eq(clientes.status, 'encerrado'),
    )

  const todosClientes = [...clientesRows, ...clientesEncerrados]

  // Avaliar
  const alertasContratos = avaliarContratos(contratosRows)
  const alertasTransacoes = avaliarTransacoes(transacoesRows)
  const alertasClientes = avaliarClientesInativos(todosClientes)

  // Unificar e ordenar
  return ordenarPorSeveridade([
    ...alertasContratos,
    ...alertasTransacoes,
    ...alertasClientes,
  ])
}

/**
 * Alertas relevantes para um cliente especifico (filtra os alertas gerais por clienteId).
 */
export async function getAlertasDoCliente(clienteId: string): Promise<Alerta[]> {
  const todos = await getAlertas()
  return todos.filter((a) => a.clienteId === clienteId)
}
