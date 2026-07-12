'use server'

import { eq, sql, and, lte, gte, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { transacoes, contratos, clientes } from '@/lib/db/schema'
import { transacaoSchema, type TransacaoInput } from '@/lib/validations/transacao'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'

const ERRO_VALIDACAO = 'Nao foi possivel salvar. Verifique os dados e tente novamente.'

export async function createTransacao(input: TransacaoInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const parsed = transacaoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const { valor, diaVencto, ...rest } = parsed.data

  const [novo] = await db
    .insert(transacoes)
    .values({
      ...rest,
      valor: valor.toFixed(2),
      diaVencto: diaVencto ?? null,
      clienteId: rest.clienteId ?? null,
    })
    .returning({ id: transacoes.id })

  return { data: { id: novo.id } }
}

export async function listTransacoes(filtros?: { mes?: number; ano?: number }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const agora = new Date()
  const mes = filtros?.mes ?? agora.getMonth() + 1
  const ano = filtros?.ano ?? agora.getFullYear()

  const rows = await db
    .select({
      id: transacoes.id,
      tipo: transacoes.tipo,
      categoria: transacoes.categoria,
      clienteId: transacoes.clienteId,
      clienteNome: clientes.nome,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      status: transacoes.status,
      diaVencto: transacoes.diaVencto,
      notas: transacoes.notas,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .where(
      and(
        sql`extract(month from ${transacoes.data}) = ${mes}`,
        sql`extract(year from ${transacoes.data}) = ${ano}`,
      ),
    )
    .orderBy(desc(transacoes.data))

  return rows
}

export async function deleteTransacao(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir transacoes.' }
  }

  await db.delete(transacoes).where(eq(transacoes.id, id))

  return { data: { id } }
}

export type CobrancaCliente = {
  id: string
  descricao: string
  valor: string
  data: string
  status: 'pago' | 'pendente' | 'vencido'
  diaVencto: number | null
}

export async function getCobrancasDoCliente(clienteId: string): Promise<CobrancaCliente[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: transacoes.id,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      status: transacoes.status,
      diaVencto: transacoes.diaVencto,
    })
    .from(transacoes)
    .where(and(eq(transacoes.clienteId, clienteId), eq(transacoes.tipo, 'receita')))
    .orderBy(desc(transacoes.data))
}

export async function updateTransacaoStatus(
  id: string,
  clienteId: string,
  status: 'pago' | 'pendente' | 'vencido',
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  await db
    .update(transacoes)
    .set({ status, updatedAt: new Date() })
    .where(eq(transacoes.id, id))

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/financeiro')
  return { data: { ok: true } }
}

export async function createCobranca(
  clienteId: string,
  input: { descricao: string; valor: number; data: string; diaVencto?: number },
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const descricao = input.descricao?.trim()
  if (!descricao) {
    return { error: 'Informe a descricao da cobranca.' }
  }
  if (!(input.valor > 0)) {
    return { error: 'O valor deve ser maior que zero.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    return { error: 'Data invalida.' }
  }
  const diaVencto =
    input.diaVencto != null && input.diaVencto >= 1 && input.diaVencto <= 31
      ? input.diaVencto
      : null

  await db.insert(transacoes).values({
    tipo: 'receita',
    categoria: 'mensalidade',
    clienteId,
    descricao,
    valor: input.valor.toFixed(2),
    data: input.data,
    status: 'pendente',
    diaVencto,
  })

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/financeiro')
  return { data: { ok: true } }
}

export async function setUsaAsaas(clienteId: string, usaAsaas: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  await db
    .update(clientes)
    .set({ usaAsaas, updatedAt: new Date() })
    .where(eq(clientes.id, clienteId))

  revalidatePath(`/clientes/${clienteId}`)
  return { data: { ok: true } }
}

export async function calcularMrr() {
  const hoje = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const [result] = await db
    .select({
      total: sql<string>`coalesce(sum(${contratos.valorMensal}), '0')`,
    })
    .from(contratos)
    .where(
      and(
        lte(contratos.dataInicio, hoje),
        gte(contratos.dataVencimento, hoje),
      ),
    )

  return Number(result.total)
}

export async function getResumoFinanceiro(mes?: number, ano?: number) {
  const agora = new Date()
  const m = mes ?? agora.getMonth() + 1
  const a = ano ?? agora.getFullYear()

  const [result] = await db
    .select({
      receita: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' then ${transacoes.valor} else 0 end), '0')`,
      despesa: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' then ${transacoes.valor} else 0 end), '0')`,
    })
    .from(transacoes)
    .where(
      and(
        sql`extract(month from ${transacoes.data}) = ${m}`,
        sql`extract(year from ${transacoes.data}) = ${a}`,
      ),
    )

  const receita = Number(result.receita)
  const despesa = Number(result.despesa)

  return {
    receita,
    despesa,
    lucro: receita - despesa,
  }
}
