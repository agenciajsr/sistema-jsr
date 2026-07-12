'use server'

import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { checklistItems } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'

const FREQUENCIAS = ['diaria', 'semanal', 'mensal'] as const
export type FrequenciaChecklist = (typeof FREQUENCIAS)[number]

export type ChecklistItemDb = {
  id: string
  clienteId: string
  tarefa: string
  frequencia: FrequenciaChecklist
  concluido: boolean
}

export async function getChecklistDoCliente(clienteId: string): Promise<ChecklistItemDb[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const rows = await db.query.checklistItems.findMany({
    where: eq(checklistItems.clienteId, clienteId),
    orderBy: [asc(checklistItems.createdAt)],
  })

  return rows.map((r) => ({
    id: r.id,
    clienteId: r.clienteId,
    tarefa: r.tarefa,
    frequencia: r.frequencia,
    concluido: r.concluido,
  }))
}

export async function addChecklistItem(
  clienteId: string,
  tarefa: string,
  frequencia: FrequenciaChecklist,
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const tarefaLimpa = tarefa.trim()
  if (!tarefaLimpa) {
    return { error: 'Informe a tarefa do checklist.' }
  }
  if (!FREQUENCIAS.includes(frequencia)) {
    return { error: 'Frequencia invalida.' }
  }

  await db.insert(checklistItems).values({
    clienteId,
    tarefa: tarefaLimpa,
    frequencia,
  })

  revalidatePath(`/clientes/${clienteId}`)
  return { data: { ok: true } }
}

export async function toggleChecklistItem(
  id: string,
  clienteId: string,
  concluido: boolean,
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  await db
    .update(checklistItems)
    .set({ concluido, updatedAt: new Date() })
    .where(eq(checklistItems.id, id))

  revalidatePath(`/clientes/${clienteId}`)
  return { data: { ok: true } }
}

export async function deleteChecklistItem(id: string, clienteId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  await db.delete(checklistItems).where(eq(checklistItems.id, id))

  revalidatePath(`/clientes/${clienteId}`)
  return { data: { ok: true } }
}
