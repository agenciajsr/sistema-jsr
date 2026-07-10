'use server'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos } from '@/lib/db/schema'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'
import { construirRegistroRenovacao } from '@/lib/contratos/renovacao'
import { selecionarContratoAtual } from '@/lib/contratos/current'
import { requireAdmin } from '@/lib/auth/session'

const ERRO_VALIDACAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

export async function registrarContrato(clienteId: string, input: ContratoInput) {
  const parsed = contratoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const registro = construirRegistroRenovacao(clienteId, {
    dataInicio: parsed.data.dataInicio,
    dataVencimento: parsed.data.dataVencimento,
    valorMensal: parsed.data.valorMensal,
  })

  // D-06: renovação sempre insere um novo registro — nunca db.update.
  await db.insert(contratos).values(registro)

  return { data: { clienteId } }
}

export async function deleteContrato(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir contratos.' }
  }

  await db.delete(contratos).where(eq(contratos.id, id))

  return { data: { id } }
}

export async function getContratosDoCliente(clienteId: string) {
  const historico = await db.query.contratos.findMany({
    where: eq(contratos.clienteId, clienteId),
    orderBy: [desc(contratos.dataInicio)],
  })

  const contratoAtual = selecionarContratoAtual(historico)

  return { contratoAtual, historico }
}
