'use server'

// Busca global do header — clientes e leads por nome (ilike, sem full-text:
// ~10 clientes e centenas de leads não justificam índice de busca).

import { desc, ilike } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, crmContatos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'

export type ResultadoBusca = {
  clientes: { id: string; nome: string; status: string }[]
  leads: { id: string; nome: string; telefone: string | null }[]
}

export async function buscarGlobal(termo: string): Promise<ResultadoBusca> {
  const vazio: ResultadoBusca = { clientes: [], leads: [] }

  const currentUser = await getCurrentUser()
  if (!currentUser) return vazio

  const limpo = termo.trim()
  if (limpo.length < 2) return vazio

  const padrao = `%${limpo}%`
  try {
    const clientesRows = await db
      .select({ id: clientes.id, nome: clientes.nome, status: clientes.status })
      .from(clientes)
      .where(ilike(clientes.nome, padrao))
      .limit(5)

    const leadsRows = await db
      .select({ id: crmContatos.id, nome: crmContatos.nome, telefone: crmContatos.telefone })
      .from(crmContatos)
      .where(ilike(crmContatos.nome, padrao))
      .orderBy(desc(crmContatos.createdAt))
      .limit(5)

    return { clientes: clientesRows, leads: leadsRows }
  } catch (e) {
    console.error('[buscarGlobal]', e)
    return vazio
  }
}
