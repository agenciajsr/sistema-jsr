'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { contratos, clientes } from '@/lib/db/schema'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'
import { construirRegistroRenovacao } from '@/lib/contratos/renovacao'
import { selecionarContratoAtual, type ContratoRow } from '@/lib/contratos/current'
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

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/contratos')
  return { data: { clienteId } }
}

// Edição de um contrato existente (admin). Diferente de registrarContrato, que
// SEMPRE insere (renovação = novo registro), esta action corrige um registro já
// existente via db.update — usada quando os dados foram digitados errados.
export async function atualizarContrato(id: string, input: ContratoInput) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem editar contratos.' }
  }

  const parsed = contratoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  // Descobre o clienteId para revalidar o detalhe do cliente correto.
  const [existente] = await db
    .select({ clienteId: contratos.clienteId })
    .from(contratos)
    .where(eq(contratos.id, id))

  if (!existente) {
    return { error: 'Contrato não encontrado.' }
  }

  await db
    .update(contratos)
    .set({
      dataInicio: parsed.data.dataInicio,
      dataVencimento: parsed.data.dataVencimento,
      valorMensal: String(parsed.data.valorMensal),
    })
    .where(eq(contratos.id, id))

  revalidatePath(`/clientes/${existente.clienteId}`)
  revalidatePath('/contratos')

  return { data: { id } }
}

export async function deleteContrato(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir contratos.' }
  }

  const [existente] = await db
    .select({ clienteId: contratos.clienteId })
    .from(contratos)
    .where(eq(contratos.id, id))

  await db.delete(contratos).where(eq(contratos.id, id))

  if (existente) revalidatePath(`/clientes/${existente.clienteId}`)
  revalidatePath('/contratos')
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

export type ContratoConsolidado = {
  id: string
  clienteId: string
  clienteNome: string
  dataInicio: string
  dataVencimento: string
  valorMensal: string
  vigente: boolean
}

// Lista TODOS os contratos (de todos os clientes) para a tela /contratos.
// Marca como `vigente` o contrato atual de cada cliente (maior dataInicio),
// mesma regra usada na ficha do cliente — evita contar duplicatas no MRR.
export async function listarTodosContratos(): Promise<ContratoConsolidado[]> {
  const rows = await db
    .select({
      id: contratos.id,
      clienteId: contratos.clienteId,
      clienteNome: clientes.nome,
      dataInicio: contratos.dataInicio,
      dataVencimento: contratos.dataVencimento,
      valorMensal: contratos.valorMensal,
    })
    .from(contratos)
    .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
    .orderBy(clientes.nome, desc(contratos.dataInicio))

  // Agrupa por cliente e descobre o contrato vigente (atual) de cada um.
  const porCliente = new Map<string, ContratoRow[]>()
  for (const r of rows) {
    const lista = porCliente.get(r.clienteId) ?? []
    lista.push(r)
    porCliente.set(r.clienteId, lista)
  }
  const vigenteIds = new Set<string>()
  for (const lista of porCliente.values()) {
    const atual = selecionarContratoAtual(lista)
    if (atual) vigenteIds.add(atual.id)
  }

  return rows.map((r) => ({ ...r, vigente: vigenteIds.has(r.id) }))
}
