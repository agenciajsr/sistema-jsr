'use server'

import { eq, and, desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, adAccounts, relatorios } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { gerarRelatorioCliente, type RelatorioGerado } from '@/lib/relatorios/gerar-relatorio'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'

/**
 * Grava um relatório gerado manualmente no histórico (tipo 'manual').
 * Falha ao salvar NÃO impede devolver o relatório — loga e segue.
 */
async function persistirRelatorioManual(relatorio: RelatorioGerado): Promise<void> {
  try {
    await db.insert(relatorios).values({
      clienteId: relatorio.clienteId,
      clienteNome: relatorio.clienteNome,
      tipo: 'manual',
      periodoInicio: relatorio.periodoInicio,
      periodoFim: relatorio.periodoFim,
      conteudo: relatorio.textoWhatsapp,
    })
  } catch (err) {
    console.error('[Relatórios] falha ao salvar histórico — seguindo sem salvar:', err)
  }
}

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
          // Google Ads mantido fora: relatório é client-facing e o mapeamento de métricas Google ainda não foi validado (PASSO B). Ver quick 260721-xa1.
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
    await persistirRelatorioManual(relatorio)
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
        await persistirRelatorioManual(relatorio)
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

export type RelatorioHistorico = {
  id: string
  clienteNome: string
  tipo: string // 'semanal' (legado) | 'manual' | 'automatico'
  periodoInicio: string
  periodoFim: string
  conteudo: string
  geradoEm: string // ISO
}

/**
 * Histórico de relatórios salvos (cron semanal + gerações manuais), mais recentes primeiro.
 */
export async function listarHistoricoRelatorios(): Promise<RelatorioHistorico[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const rows = await db
    .select()
    .from(relatorios)
    .orderBy(desc(relatorios.geradoEm))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    clienteNome: r.clienteNome,
    tipo: r.tipo,
    periodoInicio: r.periodoInicio,
    periodoFim: r.periodoFim,
    conteudo: r.conteudo,
    geradoEm: r.geradoEm.toISOString(),
  }))
}
