'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { clientes, contratos } from '@/lib/db/schema'
import { clienteSchema, type ClienteInput } from '@/lib/validations/cliente'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'
import { construirRegistroRenovacao } from '@/lib/contratos/renovacao'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'

const ERRO_VALIDACAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

export async function createClienteComContrato(
  clienteInput: ClienteInput,
  contratoInput: ContratoInput
) {
  const clienteParsed = clienteSchema.safeParse(clienteInput)
  const contratoParsed = contratoSchema.safeParse(contratoInput)

  if (!clienteParsed.success || !contratoParsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const clienteId = await db.transaction(async (tx) => {
    const [novoCliente] = await tx
      .insert(clientes)
      .values(clienteParsed.data)
      .returning({ id: clientes.id })

    const registro = construirRegistroRenovacao(novoCliente.id, {
      dataInicio: contratoParsed.data.dataInicio,
      dataVencimento: contratoParsed.data.dataVencimento,
      valorMensal: contratoParsed.data.valorMensal,
    })

    await tx.insert(contratos).values(registro)

    return novoCliente.id
  })

  return { data: { clienteId } }
}

export async function updateCliente(id: string, input: ClienteInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const parsed = clienteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  await db
    .update(clientes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clientes.id, id))

  return { data: { id } }
}

type MetaInput = { metaCpa: string | null; metaCpl: string | null; metaRoas: string | null }

// Normaliza um campo de meta: vazio → null; caso contrário exige número >= 0.
// Retorna { valor } (string numérica ou null) ou { erro } se inválido.
function normalizarMeta(raw: string | null): { valor: string | null } | { erro: true } {
  if (raw == null) return { valor: null }
  const trimmed = raw.trim()
  if (trimmed === '') return { valor: null }
  const num = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(num) || num < 0) return { erro: true }
  return { valor: String(num) }
}

export async function updateMetasCliente(clienteId: string, input: MetaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const cpa = normalizarMeta(input.metaCpa)
  const cpl = normalizarMeta(input.metaCpl)
  const roas = normalizarMeta(input.metaRoas)

  if ('erro' in cpa || 'erro' in cpl || 'erro' in roas) {
    return { error: 'As metas devem ser números maiores ou iguais a zero.' }
  }

  await db
    .update(clientes)
    .set({
      metaCpa: cpa.valor,
      metaCpl: cpl.valor,
      metaRoas: roas.valor,
      updatedAt: new Date(),
    })
    .where(eq(clientes.id, clienteId))

  revalidatePath('/clientes/' + clienteId)
  revalidatePath('/campanhas')

  return { data: { id: clienteId } }
}

export async function deleteCliente(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir clientes.' }
  }

  await db.delete(clientes).where(eq(clientes.id, id))

  return { data: { id } }
}
