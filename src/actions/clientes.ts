'use server'

import { eq } from 'drizzle-orm'

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

export async function deleteCliente(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir clientes.' }
  }

  await db.delete(clientes).where(eq(clientes.id, id))

  return { data: { id } }
}
