'use server'

import { eq, sql, and, lte, gte, desc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { addMonths } from 'date-fns'

import { db } from '@/lib/db'
import { transacoes, contratos, clientes, profiles } from '@/lib/db/schema'
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

  const { valor, diaVencto, centroCusto, recorrencia, formaPagamento, responsavelId, ...rest } = parsed.data

  const [novo] = await db
    .insert(transacoes)
    .values({
      ...rest,
      valor: valor.toFixed(2),
      diaVencto: diaVencto ?? null,
      clienteId: rest.clienteId ?? null,
      centroCusto: centroCusto ?? null,
      recorrencia: recorrencia ?? 'avulsa',
      formaPagamento: formaPagamento ?? null,
      responsavelId: responsavelId ?? null,
    })
    .returning({ id: transacoes.id })

  // Gerar parcelas automaticamente se recorrencia != avulsa
  if (recorrencia && recorrencia !== 'avulsa') {
    await gerarParcelasRecorrentes(novo.id, parsed.data)
  }

  revalidatePath('/financeiro')
  return { data: { id: novo.id } }
}

export async function gerarParcelasRecorrentes(transacaoPaiId: string, input: TransacaoInput) {
  const hoje = new Date()
  let dataFinal: Date

  // Determinar data final: contrato vigente ou 12 meses
  if (input.clienteId) {
    const hojeStr = hoje.toISOString().slice(0, 10)
    const [contrato] = await db
      .select({ dataVencimento: contratos.dataVencimento })
      .from(contratos)
      .where(
        and(
          eq(contratos.clienteId, input.clienteId),
          lte(contratos.dataInicio, hojeStr),
          gte(contratos.dataVencimento, hojeStr),
        ),
      )
      .limit(1)

    dataFinal = contrato ? new Date(contrato.dataVencimento) : addMonths(hoje, 12)
  } else {
    dataFinal = addMonths(hoje, 12)
  }

  const incrementoMeses = input.recorrencia === 'trimestral' ? 3 : 1
  const dataBase = new Date(input.data)
  const parcelas: (typeof transacoes.$inferInsert)[] = []

  let dataParcela = addMonths(dataBase, incrementoMeses)
  while (dataParcela <= dataFinal) {
    parcelas.push({
      tipo: input.tipo,
      categoria: input.categoria,
      clienteId: input.clienteId ?? null,
      descricao: input.descricao,
      valor: input.valor.toFixed(2),
      data: dataParcela.toISOString().slice(0, 10),
      status: 'pendente',
      diaVencto: input.diaVencto ?? null,
      notas: input.notas ?? null,
      centroCusto: input.centroCusto ?? null,
      recorrencia: input.recorrencia ?? 'avulsa',
      formaPagamento: input.formaPagamento ?? null,
      responsavelId: input.responsavelId ?? null,
      transacaoPaiId,
    })
    dataParcela = addMonths(dataParcela, incrementoMeses)
  }

  if (parcelas.length > 0) {
    await db.insert(transacoes).values(parcelas)
  }
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
      centroCusto: transacoes.centroCusto,
      formaPagamento: transacoes.formaPagamento,
      responsavelNome: profiles.nome,
      comprovanteUrl: transacoes.comprovanteUrl,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .leftJoin(profiles, eq(transacoes.responsavelId, profiles.id))
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
      receita: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
      despesa: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
      aReceber: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} in ('pendente', 'vencido') then ${transacoes.valor} else 0 end), '0')`,
      aPagar: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' and ${transacoes.status} in ('pendente', 'vencido') then ${transacoes.valor} else 0 end), '0')`,
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
    aReceber: Number(result.aReceber),
    aPagar: Number(result.aPagar),
  }
}

// --- Novas actions ---

export async function getPrevisaoCaixa() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { totalReceber: 0, totalPagar: 0, saldoProjetado: 0, items: [] }

  const hoje = new Date().toISOString().slice(0, 10)
  const em30dias = addMonths(new Date(), 1).toISOString().slice(0, 10)

  // Transacoes pendentes nos proximos 30 dias
  const rows = await db
    .select({
      id: transacoes.id,
      tipo: transacoes.tipo,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      clienteNome: clientes.nome,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .where(
      and(
        inArray(transacoes.status, ['pendente', 'vencido']),
        gte(transacoes.data, hoje),
        lte(transacoes.data, em30dias),
      ),
    )
    .orderBy(transacoes.data)

  let totalReceber = 0
  let totalPagar = 0
  const items = rows.map((r) => {
    const valor = Number(r.valor)
    if (r.tipo === 'receita') totalReceber += valor
    else totalPagar += valor
    return {
      descricao: r.clienteNome ? `${r.descricao} (${r.clienteNome})` : r.descricao,
      valor,
      data: r.data,
      tipo: r.tipo as 'receita' | 'despesa',
    }
  })

  return {
    totalReceber,
    totalPagar,
    saldoProjetado: totalReceber - totalPagar,
    items,
  }
}

export async function getContasAReceber() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: transacoes.id,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      status: transacoes.status,
      clienteNome: clientes.nome,
      centroCusto: transacoes.centroCusto,
      formaPagamento: transacoes.formaPagamento,
      responsavelNome: profiles.nome,
      comprovanteUrl: transacoes.comprovanteUrl,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .leftJoin(profiles, eq(transacoes.responsavelId, profiles.id))
    .where(
      and(
        eq(transacoes.tipo, 'receita'),
        inArray(transacoes.status, ['pendente', 'vencido']),
      ),
    )
    .orderBy(transacoes.data)
}

export async function getContasAPagar() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: transacoes.id,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      status: transacoes.status,
      clienteNome: clientes.nome,
      centroCusto: transacoes.centroCusto,
      formaPagamento: transacoes.formaPagamento,
      responsavelNome: profiles.nome,
      comprovanteUrl: transacoes.comprovanteUrl,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .leftJoin(profiles, eq(transacoes.responsavelId, profiles.id))
    .where(
      and(
        eq(transacoes.tipo, 'despesa'),
        inArray(transacoes.status, ['pendente', 'vencido']),
      ),
    )
    .orderBy(transacoes.data)
}

export async function uploadComprovante(transacaoId: string, url: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  await db
    .update(transacoes)
    .set({ comprovanteUrl: url, updatedAt: new Date() })
    .where(eq(transacoes.id, transacaoId))

  revalidatePath('/financeiro')
  return { data: { url } }
}
