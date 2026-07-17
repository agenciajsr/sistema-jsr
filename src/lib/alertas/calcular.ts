/**
 * Cálculo puro dos alertas atuais do sistema (sem sessão de usuário).
 *
 * Extraído de src/actions/alertas.ts para poder rodar tanto nas Server Actions
 * (com sessão) quanto no cron diário (sem usuário logado). NÃO altera nenhuma
 * regra de negócio — apenas orquestra as queries e os avaliadores existentes.
 */

import { eq, lte } from 'drizzle-orm'
import { addDays, format } from 'date-fns'

import { db } from '@/lib/db'
import { contratos, transacoes, clientes, adAccounts } from '@/lib/db/schema'
import {
  avaliarContratos,
  avaliarTransacoes,
  avaliarClientesInativos,
  avaliarSaldoContas,
  ordenarPorSeveridade,
} from '@/lib/alertas/avaliar'
import { getAlertasCampanhas } from '@/lib/saude/avaliar-campanhas'
import { getAlertasCampanhaDiarios } from '@/lib/alertas/regras-campanha'
import type { Alerta } from '@/lib/alertas/types'

/**
 * Avalia todas as fontes de alerta (contratos, transações, clientes, verba,
 * saúde de campanhas) e retorna a lista ordenada por severidade.
 */
export async function calcularAlertasAtuais(): Promise<Alerta[]> {
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

  // 4. Contas de anuncio com saldo baixo
  const contasRows = await db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      clienteId: adAccounts.clienteId,
      clienteNome: clientes.nome,
      saldo: adAccounts.saldo,
    })
    .from(adAccounts)
    .leftJoin(clientes, eq(adAccounts.clienteId, clientes.id))
    .where(eq(adAccounts.ativo, true))

  // Avaliar
  const alertasContratos = avaliarContratos(contratosRows)
  const alertasTransacoes = avaliarTransacoes(transacoesRows)
  const alertasClientes = avaliarClientesInativos(todosClientes)
  const alertasSaldo = avaliarSaldoContas(contasRows)

  // Alertas de saúde de campanha (Meta): comparação de períodos sobre insights.
  // Envolvido em try/catch — uma falha aqui (ex.: sem dados Meta) NÃO pode
  // derrubar os demais alertas, que sempre precisam retornar.
  let alertasCampanhas: Alerta[] = []
  try {
    alertasCampanhas = await getAlertasCampanhas()
  } catch (erro) {
    console.error('[calcularAlertasAtuais] falha ao avaliar saúde de campanhas — ignorando', erro)
    alertasCampanhas = []
  }

  // Regras DIÁRIAS por campanha/anúncio/conta (Feature 2 — 17/jul/2026).
  // getAlertasCampanhaDiarios já é à prova de falha (retorna [] em erro).
  const alertasDiarios = await getAlertasCampanhaDiarios()

  // Unificar e ordenar
  return ordenarPorSeveridade([
    ...alertasContratos,
    ...alertasTransacoes,
    ...alertasClientes,
    ...alertasSaldo,
    ...alertasCampanhas,
    ...alertasDiarios,
  ])
}
