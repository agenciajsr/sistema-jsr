'use server'

import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { acompanhamentos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'

export type AcompanhamentoDb = {
  id: string
  clienteId: string
  autorId: string | null
  autorNome: string
  nota: string
  createdAt: Date
}

export async function getAcompanhamentosDoCliente(
  clienteId: string,
): Promise<AcompanhamentoDb[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const rows = await db.query.acompanhamentos.findMany({
    where: eq(acompanhamentos.clienteId, clienteId),
    orderBy: [desc(acompanhamentos.createdAt)],
  })

  return rows.map((r) => ({
    id: r.id,
    clienteId: r.clienteId,
    autorId: r.autorId,
    autorNome: r.autorNome,
    nota: r.nota,
    createdAt: r.createdAt,
  }))
}

export async function addAcompanhamento(clienteId: string, nota: string) {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const notaLimpa = nota.trim()
  if (!notaLimpa) {
    return { error: 'Escreva uma nota antes de salvar.' }
  }

  await db.insert(acompanhamentos).values({
    clienteId,
    autorId: user.id,
    autorNome: user.nome,
    nota: notaLimpa,
  })

  revalidatePath(`/clientes/${clienteId}`)
  return { data: { ok: true } }
}
