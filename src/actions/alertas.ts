'use server'

import { eq, ne, and, desc, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { alertas } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { ordenarPorSeveridade } from '@/lib/alertas/avaliar'
import { avaliarEPersistirAlertas, type ResumoAvaliacao } from '@/lib/alertas/persistir'
import type { Alerta, AlertaPersistido, StatusAlerta, TipoAlerta, SeveridadeAlerta } from '@/lib/alertas/types'

// Shape da linha da tabela alertas usado nos mapeamentos abaixo
type LinhaAlerta = typeof alertas.$inferSelect

/** Converte uma linha do banco para o contrato antigo Alerta (id = chaveDedup). */
function linhaParaAlerta(row: LinhaAlerta): Alerta {
  return {
    id: row.chaveDedup,
    tipo: row.tipo as TipoAlerta,
    severidade: row.severidade as SeveridadeAlerta,
    titulo: row.titulo,
    detalhe: row.detalhe,
    clienteNome: row.clienteNome,
    clienteId: row.clienteId ?? '',
    dataRelevante: row.dataRelevante,
  }
}

function linhaParaAlertaPersistido(row: LinhaAlerta): AlertaPersistido {
  return {
    ...linhaParaAlerta(row),
    dbId: row.id,
    status: row.status as StatusAlerta,
    detectadoEm: row.detectadoEm.toISOString(),
    resolvidoEm: row.resolvidoEm ? row.resolvidoEm.toISOString() : null,
  }
}

/**
 * Alertas abertos (não resolvidos), lidos da tabela `alertas`.
 * Mantém a assinatura antiga — dashboard e chat IA consomem sem mudanças.
 */
export async function getAlertas(): Promise<Alerta[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const rows = await db
    .select()
    .from(alertas)
    .where(ne(alertas.status, 'resolvido'))

  return ordenarPorSeveridade(rows.map(linhaParaAlerta))
}

/**
 * Alertas abertos de um cliente específico (query direta no banco).
 */
export async function getAlertasDoCliente(clienteId: string): Promise<Alerta[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const rows = await db
    .select()
    .from(alertas)
    .where(and(eq(alertas.clienteId, clienteId), ne(alertas.status, 'resolvido')))

  return ordenarPorSeveridade(rows.map(linhaParaAlerta))
}

/**
 * Todos os alertas (inclusive resolvidos) para a página de triagem com abas.
 * Abertos ordenados por severidade; resolvidos por resolvidoEm desc.
 */
export async function listarAlertasPersistidos(): Promise<AlertaPersistido[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const rows = await db
    .select()
    .from(alertas)
    .orderBy(desc(alertas.detectadoEm))
    .limit(200)

  const abertos = rows.filter((r) => r.status !== 'resolvido').map(linhaParaAlertaPersistido)
  const resolvidos = rows
    .filter((r) => r.status === 'resolvido')
    .map(linhaParaAlertaPersistido)
    .sort((a, b) => (b.resolvidoEm ?? '').localeCompare(a.resolvidoEm ?? ''))

  return [...(ordenarPorSeveridade(abertos) as AlertaPersistido[]), ...resolvidos]
}

/**
 * Contagem de alertas com status 'novo' — barata, para o sininho do header.
 */
export async function getContagemAlertasNovos(): Promise<number> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return 0

  const [row] = await db
    .select({ total: count() })
    .from(alertas)
    .where(eq(alertas.status, 'novo'))

  return row?.total ?? 0
}

/** Marca um alerta como lido (novo → lido). */
export async function marcarAlertaComoLido(dbId: string): Promise<void> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return

  await db
    .update(alertas)
    .set({ status: 'lido', updatedAt: new Date() })
    .where(and(eq(alertas.id, dbId), eq(alertas.status, 'novo')))

  revalidatePath('/alertas')
}

/** Marca TODOS os alertas novos como lidos. */
export async function marcarTodosComoLidos(): Promise<void> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return

  await db
    .update(alertas)
    .set({ status: 'lido', updatedAt: new Date() })
    .where(eq(alertas.status, 'novo'))

  revalidatePath('/alertas')
}

/**
 * Reavalia os alertas agora (mesmo motor do cron). Cobre o primeiro deploy
 * (tabela vazia até o cron rodar) e dá um botão manual na página.
 */
export async function reavaliarAlertasAgora(): Promise<ResumoAvaliacao | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  const resumo = await avaliarEPersistirAlertas()
  revalidatePath('/alertas')
  return resumo
}
