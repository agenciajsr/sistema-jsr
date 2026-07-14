'use server'

import { eq, sql, and, lte, gte, gt, desc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { addMonths, addWeeks } from 'date-fns'

import { db } from '@/lib/db'
import { transacoes, contratos, clientes, profiles } from '@/lib/db/schema'
import { transacaoSchema, type TransacaoInput } from '@/lib/validations/transacao'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { hojeBrasilia } from '@/lib/date-br'
import {
  calcularVariacaoPercentual,
  calcularDespesasVsFaturamento,
  contarRenovados,
  calcularTaxaRenovacao,
  calcularLucroPorCliente,
  calcularDependencia,
  periodoMesAnterior,
  type Faixa,
} from '@/lib/financeiro/calculos'

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

  const { valor, diaVencto, centroCusto, recorrencia, formaPagamento, responsavelId, comprovanteUrl, ...rest } = parsed.data

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
      comprovanteUrl: comprovanteUrl ?? null,
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

  // Semanal avança 7 dias; mensal/trimestral avançam meses. 'avulsa' não gera parcelas.
  const isSemanal = input.recorrencia === 'semanal'
  const incrementoMeses = input.recorrencia === 'trimestral' ? 3 : 1
  const proximaData = (d: Date) => (isSemanal ? addWeeks(d, 1) : addMonths(d, incrementoMeses))
  const dataBase = new Date(input.data)
  const parcelas: (typeof transacoes.$inferInsert)[] = []

  let dataParcela = proximaData(dataBase)
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
    dataParcela = proximaData(dataParcela)
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
      recorrencia: transacoes.recorrencia,
      formaPagamento: transacoes.formaPagamento,
      responsavelId: transacoes.responsavelId,
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

export async function updateTransacao(id: string, input: TransacaoInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const parsed = transacaoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const { valor, diaVencto, centroCusto, recorrencia, formaPagamento, responsavelId, comprovanteUrl, ...rest } = parsed.data

  await db
    .update(transacoes)
    .set({
      ...rest,
      valor: valor.toFixed(2),
      diaVencto: diaVencto ?? null,
      clienteId: rest.clienteId ?? null,
      centroCusto: centroCusto ?? null,
      recorrencia: recorrencia ?? 'avulsa',
      formaPagamento: formaPagamento ?? null,
      responsavelId: responsavelId ?? null,
      comprovanteUrl: comprovanteUrl ?? null,
      updatedAt: new Date(),
    })
    .where(eq(transacoes.id, id))

  revalidatePath('/financeiro')
  return { data: { id } }
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

// --- Visao Analitica ---

export type VisaoAnaliticaData = {
  mesAnterior: { receita: number; despesa: number; lucro: number; mrr: number }
  variacao: { receita: number | null; despesa: number | null; lucro: number | null; mrr: number | null }
  receitaAvulsa: number
  lucroPorCliente: number
  clientesAtivos: number
  despesasVsFaturamento: { percentual: number | null; faixa: Faixa | null; despesa: number; receita: number }
  taxaRenovacao: { renovados: number; total: number; percentual: number }
  dependencia: {
    mrrTotal: number
    topClientes: { nome: string; valor: number; percentual: number }[]
    percentTop5: number
    percentTop10: number
  }
}

const VISAO_ANALITICA_VAZIA: VisaoAnaliticaData = {
  mesAnterior: { receita: 0, despesa: 0, lucro: 0, mrr: 0 },
  variacao: { receita: null, despesa: null, lucro: null, mrr: null },
  receitaAvulsa: 0,
  lucroPorCliente: 0,
  clientesAtivos: 0,
  despesasVsFaturamento: { percentual: null, faixa: null, despesa: 0, receita: 0 },
  taxaRenovacao: { renovados: 0, total: 0, percentual: 100 },
  dependencia: { mrrTotal: 0, topClientes: [], percentTop5: 0, percentTop10: 0 },
}

/**
 * Indicadores analiticos do mes: comparativo com o mes anterior, taxa de
 * renovacao, dependencia do MRR e relacao despesa/faturamento.
 *
 * CRITICO: as queries rodam SEQUENCIALMENTE (sem Promise.all interno). O pool e
 * max=3 e esta action ja roda dentro de um Promise.all no LOTE 2 da pagina —
 * paralelizar aqui dentro estouraria o pool e reintroduziria o travamento
 * corrigido no quick 260713-usi.
 */
export async function getVisaoAnalitica(mes?: number, ano?: number): Promise<VisaoAnaliticaData> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return VISAO_ANALITICA_VAZIA

  const agora = new Date()
  const m = mes ?? agora.getMonth() + 1
  const a = ano ?? agora.getFullYear()

  // 1. Mes anterior — reusa a logica ja validada em producao.
  const { mes: mAnt, ano: aAnt, ultimoDia } = periodoMesAnterior(m, a)
  const resumoAnterior = await getResumoFinanceiro(mAnt, aAnt)

  // 2. MRR vigente no ultimo dia do mes anterior.
  const [mrrAntRow] = await db
    .select({ total: sql<string>`coalesce(sum(${contratos.valorMensal}), '0')` })
    .from(contratos)
    .where(and(lte(contratos.dataInicio, ultimoDia), gte(contratos.dataVencimento, ultimoDia)))
  const mrrAnterior = Number(mrrAntRow.total)

  // 3. Agregado do mes atual em UMA query (receita + despesa + avulsa).
  const [atual] = await db
    .select({
      receita: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
      despesa: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
      avulsa: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} = 'pago' and ${transacoes.categoria} <> 'mensalidade' then ${transacoes.valor} else 0 end), '0')`,
    })
    .from(transacoes)
    .where(
      and(
        sql`extract(month from ${transacoes.data}) = ${m}`,
        sql`extract(year from ${transacoes.data}) = ${a}`,
      ),
    )

  const receitaAtual = Number(atual.receita)
  const despesaAtual = Number(atual.despesa)
  const receitaAvulsa = Number(atual.avulsa)
  const lucroAtual = receitaAtual - despesaAtual

  // 4. Clientes ativos.
  const [cliRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(clientes)
    .where(eq(clientes.status, 'ativo'))
  const clientesAtivos = Number(cliRow.total)

  // 5. Taxa de renovacao — contratos vencendo dentro do mes selecionado.
  const primeiroDiaMes = `${a}-${String(m).padStart(2, '0')}-01`
  const ultimoDiaMes = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)

  const vencidos = await db
    .select({ clienteId: contratos.clienteId, dataVencimento: contratos.dataVencimento })
    .from(contratos)
    .where(
      and(gte(contratos.dataVencimento, primeiroDiaMes), lte(contratos.dataVencimento, ultimoDiaMes)),
    )

  // Query B so faz sentido se houve vencimentos (evita inArray com lista vazia).
  // O filtro por data em SQL e um pre-corte; a regra exata (dataInicio > o
  // dataVencimento DAQUELE contrato) fica na funcao pura testada.
  let posteriores: { clienteId: string; dataInicio: string }[] = []
  if (vencidos.length > 0) {
    posteriores = await db
      .select({ clienteId: contratos.clienteId, dataInicio: contratos.dataInicio })
      .from(contratos)
      .where(
        and(
          inArray(contratos.clienteId, [...new Set(vencidos.map((v) => v.clienteId))]),
          gt(contratos.dataInicio, primeiroDiaMes),
        ),
      )
  }

  const taxaRenovacao = calcularTaxaRenovacao(contarRenovados(vencidos, posteriores), vencidos.length)

  // 6. Dependencia — MRR por cliente vigente hoje (Brasilia).
  const hoje = hojeBrasilia()
  const linhas = await db
    .select({ nome: clientes.nome, valor: sql<string>`sum(${contratos.valorMensal})` })
    .from(contratos)
    .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
    .where(and(lte(contratos.dataInicio, hoje), gte(contratos.dataVencimento, hoje)))
    .groupBy(clientes.id, clientes.nome)

  const dependencia = calcularDependencia(linhas.map((l) => ({ nome: l.nome, valor: Number(l.valor) })))

  return {
    mesAnterior: {
      receita: resumoAnterior.receita,
      despesa: resumoAnterior.despesa,
      lucro: resumoAnterior.lucro,
      mrr: mrrAnterior,
    },
    variacao: {
      receita: calcularVariacaoPercentual(receitaAtual, resumoAnterior.receita),
      despesa: calcularVariacaoPercentual(despesaAtual, resumoAnterior.despesa),
      lucro: calcularVariacaoPercentual(lucroAtual, resumoAnterior.lucro),
      mrr: calcularVariacaoPercentual(dependencia.mrrTotal, mrrAnterior),
    },
    receitaAvulsa,
    lucroPorCliente: calcularLucroPorCliente(lucroAtual, clientesAtivos),
    clientesAtivos,
    despesasVsFaturamento: calcularDespesasVsFaturamento(despesaAtual, receitaAtual),
    taxaRenovacao,
    dependencia,
  }
}
