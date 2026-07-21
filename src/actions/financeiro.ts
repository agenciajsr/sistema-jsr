'use server'

import { eq, sql, and, lte, gte, gt, desc, inArray, isNotNull, isNull, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { addMonths } from 'date-fns'

import { db } from '@/lib/db'
import {
  transacoes,
  contratos,
  clientes,
  profiles,
  investimentosAquisicao,
  crmOportunidades,
  crmContatos,
} from '@/lib/db/schema'
import { transacaoSchema, type TransacaoInput } from '@/lib/validations/transacao'
import {
  investimentoAquisicaoSchema,
  type InvestimentoAquisicaoInput,
} from '@/lib/validations/investimento-aquisicao'
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
import {
  taxaDeChurn,
  churnAcumulado,
  ltvMedio,
  rankingMotivos,
  type ClienteVida,
  type ResultadoChurn,
  type ResultadoLtv,
  type MotivoRanking,
} from '@/lib/financeiro/executiva'
import {
  cacPorCanal,
  cacAcumulado,
  relacaoLtvCac,
  type ClienteGanho,
  type InvestimentoCanal,
  type ResultadoCac,
} from '@/lib/financeiro/cac'
import {
  ocorrenciasRecorrentesNoIntervalo,
  type RecorrenciaFin,
} from '@/lib/financeiro/recorrencia'

const ERRO_VALIDACAO = 'Nao foi possivel salvar. Verifique os dados e tente novamente.'

// --- Projeção das séries recorrentes (quick-260721-ogt) ---
// As previsões (por mês + caixa 30d) deixaram de somar linhas futuras
// pré-geradas (agora removidas) e passam a PROJETAR a série a partir das
// âncoras. A projeção começa SEMPRE no 1º dia do mês seguinte, então o mês
// atual (linhas reais) e o futuro (projetado) nunca se sobrepõem.

/** Datas-base da projeção, ancoradas em hoje (Brasília). */
function horizontesProjecao(hoje: string) {
  const [ano, mes] = hoje.split('-').map(Number) // mes 1-based
  const dia = Number(hoje.slice(8, 10))
  const mesAtual = hoje.slice(0, 7)
  // 1º dia do mês seguinte (mes 1-based == índice do mês seguinte 0-based).
  const primeiroDiaMesSeguinte = new Date(Date.UTC(ano, mes, 1, 12)).toISOString().slice(0, 10)
  // Teto de 12 meses — IGUAL ao antigo teto de gerarParcelasRecorrentes, para o
  // card mostrar os MESMOS meses de antes nas séries SEM contrato.
  const horizonte12 = new Date(Date.UTC(ano, mes - 1 + 12, dia, 12)).toISOString().slice(0, 10)
  return { mesAtual, primeiroDiaMesSeguinte, horizonte12 }
}

/**
 * dataVencimento máxima do contrato VIGENTE hoje por cliente (agregada em UMA
 * query, SEQUENCIAL). Sem contrato vigente → cliente ausente do mapa (a projeção
 * usa o horizonte de 12 meses). Mesma leitura do rollover.
 */
async function capContratoPorCliente(
  clienteIds: string[],
  hoje: string,
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (clienteIds.length === 0) return mapa
  const vigentes = await db
    .select({
      clienteId: contratos.clienteId,
      cap: sql<string>`max(${contratos.dataVencimento})`,
    })
    .from(contratos)
    .where(
      and(
        inArray(contratos.clienteId, clienteIds),
        lte(contratos.dataInicio, hoje),
        gte(contratos.dataVencimento, hoje),
      ),
    )
    .groupBy(contratos.clienteId)
  for (const v of vigentes) mapa.set(v.clienteId, v.cap)
  return mapa
}

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

  // Só insere a ÂNCORA (1ª competência). As próximas competências nascem pelo
  // rollover preguiçoso (rolarRecorrentes), como as cobranças dos clientes —
  // nunca mais pré-geramos 12 meses/27 semanas de futuro (quick-260721-ogt).
  revalidatePath('/financeiro')
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

  // hojeBrasilia() para real E projeção: a borda do mês/30d não pode divergir
  // por 1 dia entre as duas fontes (checker info 5).
  const hoje = hojeBrasilia()
  const em30dias = addMonths(new Date(`${hoje}T12:00:00Z`), 1).toISOString().slice(0, 10)
  const { mesAtual, primeiroDiaMesSeguinte } = horizontesProjecao(hoje)

  // Transações pendentes/vencidas nos próximos 30 dias.
  // ⚠️ BLINDAGEM CONTRA DUPLA CONTAGEM (checker Warning 1): EXCLUI os filhos
  // recorrentes de competência FUTURA (> mês atual) — se uma linha futura
  // pré-gerada sobreviver (deploy antes do --apply) ela não é somada JUNTO com a
  // projeção. O mês atual e as avulsas futuras continuam 100% reais.
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
        sql`NOT (to_char(${transacoes.data}, 'YYYY-MM') > ${mesAtual} AND ${transacoes.transacaoPaiId} IS NOT NULL AND ${transacoes.recorrencia} <> 'avulsa')`,
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

  // Projeção da série recorrente (ambos os tipos) — cobre só a fatia do próximo
  // mês dentro dos 30 dias (começa no 1º dia do mês seguinte → não sobrepõe as
  // reais do mês atual). Try/catch de degradação: falha aqui cai só nas reais.
  try {
    const ancoras = await db
      .select({
        data: transacoes.data,
        valor: transacoes.valor,
        tipo: transacoes.tipo,
        clienteId: transacoes.clienteId,
        recorrencia: transacoes.recorrencia,
        descricao: transacoes.descricao,
        clienteNome: clientes.nome,
      })
      .from(transacoes)
      .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
      .where(and(isNull(transacoes.transacaoPaiId), ne(transacoes.recorrencia, 'avulsa')))

    const clienteIds = [...new Set(ancoras.map((a) => a.clienteId).filter((v): v is string => !!v))]
    const capPorCliente = await capContratoPorCliente(clienteIds, hoje)

    const projetados: { descricao: string; valor: number; data: string; tipo: 'receita' | 'despesa' }[] = []
    for (const a of ancoras) {
      const cap = a.clienteId ? (capPorCliente.get(a.clienteId) ?? null) : null
      // ate = min(cap, em30dias): o cap do contrato limita, a janela de 30d também.
      const ate = cap != null && cap < em30dias ? cap : em30dias
      const datas = ocorrenciasRecorrentesNoIntervalo(
        a.data,
        a.recorrencia as RecorrenciaFin,
        cap,
        primeiroDiaMesSeguinte,
        ate,
      )
      const valor = Number(a.valor)
      const tipo = a.tipo as 'receita' | 'despesa'
      for (const data of datas) {
        if (tipo === 'receita') totalReceber += valor
        else totalPagar += valor
        projetados.push({
          descricao: a.clienteNome ? `${a.descricao} (${a.clienteNome})` : a.descricao,
          valor,
          data,
          tipo,
        })
      }
    }
    items.push(...projetados)
    items.sort((x, y) => x.data.localeCompare(y.data))
  } catch (e) {
    console.error('[getPrevisaoCaixa] projeção indisponível', e)
  }

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

// Previsão de receita por mês FUTURO (quick-260717-i26): agregada no banco
// (GROUP BY mês). Desde o quick-260721-ogt as linhas recorrentes futuras não são
// mais pré-geradas — os meses futuros recorrentes vêm da PROJEÇÃO da série; o mês
// atual e as avulsas futuras continuam vindo das linhas reais.
export async function getPrevisaoReceitaPorMes(): Promise<{ mes: string; total: number }[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const hoje = hojeBrasilia()
  const { mesAtual, primeiroDiaMesSeguinte, horizonte12 } = horizontesProjecao(hoje)

  // Linhas REAIS. ⚠️ BLINDAGEM CONTRA DUPLA CONTAGEM (checker Warning 1, à prova
  // de ordem): EXCLUI os filhos recorrentes de competência FUTURA (> mês atual) —
  // a PROJEÇÃO é a fonte ÚNICA dos meses futuros recorrentes. Assim, sobreviva ou
  // não uma linha futura pré-gerada, o mês futuro nunca é contado duas vezes. O
  // mês atual (recorrentes reais) e as avulsas futuras continuam somando aqui.
  const rows = await db
    .select({
      mes: sql<string>`to_char(${transacoes.data}, 'YYYY-MM')`,
      total: sql<string>`sum(${transacoes.valor})`,
    })
    .from(transacoes)
    .where(
      and(
        eq(transacoes.tipo, 'receita'),
        inArray(transacoes.status, ['pendente', 'vencido']),
        gt(transacoes.data, hoje),
        sql`NOT (to_char(${transacoes.data}, 'YYYY-MM') > ${mesAtual} AND ${transacoes.transacaoPaiId} IS NOT NULL AND ${transacoes.recorrencia} <> 'avulsa')`,
      ),
    )
    .groupBy(sql`to_char(${transacoes.data}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transacoes.data}, 'YYYY-MM')`)

  const porMes = new Map<string, number>()
  for (const r of rows) porMes.set(r.mes, Number(r.total))

  // Projeção das séries de RECEITA recorrente — fonte única dos meses futuros.
  // Try/catch de degradação: falha aqui cai só nas linhas reais, nunca quebra.
  try {
    const ancoras = await db
      .select({
        data: transacoes.data,
        valor: transacoes.valor,
        clienteId: transacoes.clienteId,
        recorrencia: transacoes.recorrencia,
      })
      .from(transacoes)
      .where(
        and(
          isNull(transacoes.transacaoPaiId),
          eq(transacoes.tipo, 'receita'),
          ne(transacoes.recorrencia, 'avulsa'),
        ),
      )

    const clienteIds = [...new Set(ancoras.map((a) => a.clienteId).filter((v): v is string => !!v))]
    const capPorCliente = await capContratoPorCliente(clienteIds, hoje)

    for (const a of ancoras) {
      // Sem contrato vigente → horizonte de 12 meses (mesmo teto de antes).
      const cap = a.clienteId ? (capPorCliente.get(a.clienteId) ?? null) : null
      const ate = cap ?? horizonte12
      const datas = ocorrenciasRecorrentesNoIntervalo(
        a.data,
        a.recorrencia as RecorrenciaFin,
        cap,
        primeiroDiaMesSeguinte,
        ate,
      )
      const valor = Number(a.valor)
      for (const data of datas) {
        const mes = data.slice(0, 7)
        porMes.set(mes, (porMes.get(mes) ?? 0) + valor)
      }
    }
  } catch (e) {
    console.error('[getPrevisaoReceitaPorMes] projeção indisponível', e)
  }

  return [...porMes.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
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

// --- Visão Executiva (churn, LTV, motivos de encerramento) ---

export type VisaoExecutivaData = {
  /** Mês de referência 'YYYY-MM' (hoje em Brasília). */
  mes: string
  churnMes: ResultadoChurn
  churn3m: ResultadoChurn
  churn6m: ResultadoChurn
  ltv: ResultadoLtv | null
  motivos: MotivoRanking[]
}

/**
 * Dados da visão executiva: poucas queries AGREGADAS SEQUENCIAIS (pool max=5,
 * regra do STATE.md — nunca dentro de Promise.all) + TODO o cálculo delegado
 * ao módulo puro src/lib/financeiro/executiva.ts.
 *
 * Retorna null quando a coluna clientes.data_encerramento ainda não existe
 * (migration 0038 pendente) — a UI mostra aviso em vez de números inventados.
 */
export async function getVisaoExecutiva(): Promise<VisaoExecutivaData | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  let linhasClientes: {
    id: string
    status: string
    dataEncerramento: string | null
    motivoEncerramento: string | null
    createdAt: Date
  }[]
  try {
    linhasClientes = await db
      .select({
        id: clientes.id,
        status: clientes.status,
        dataEncerramento: clientes.dataEncerramento,
        motivoEncerramento: clientes.motivoEncerramento,
        createdAt: clientes.createdAt,
      })
      .from(clientes)
      // LTV/churn é do negócio — o perfil interno (agência) fica fora.
      .where(eq(clientes.interno, false))
  } catch (e) {
    // Migration 0038 pendente (undefined_column) ou soluço de conexão.
    console.error('[getVisaoExecutiva]', e)
    return null
  }

  // SEQUENCIAL: 1 query agregada — primeiro contrato (min data_inicio) e
  // ticket do contrato mais recente, por cliente.
  const linhasContratos = await db
    .select({
      clienteId: contratos.clienteId,
      inicio: sql<string>`min(${contratos.dataInicio})`,
      ticket: sql<string>`(array_agg(${contratos.valorMensal} order by ${contratos.dataInicio} desc))[1]`,
    })
    .from(contratos)
    .groupBy(contratos.clienteId)

  const porCliente = new Map(linhasContratos.map((c) => [c.clienteId, c]))

  const vidas: ClienteVida[] = linhasClientes.map((c) => {
    const contrato = porCliente.get(c.id)
    return {
      id: c.id,
      status: c.status,
      // Entrada na base: data do primeiro contrato; fallback created_at.
      inicio: contrato?.inicio ?? c.createdAt.toISOString().slice(0, 10),
      dataEncerramento: c.dataEncerramento,
      motivoEncerramento: c.motivoEncerramento,
      ticketMensal: contrato?.ticket != null ? Number(contrato.ticket) : null,
    }
  })

  const hoje = hojeBrasilia()
  const mes = hoje.slice(0, 7)

  return {
    mes,
    churnMes: taxaDeChurn(vidas, mes),
    churn3m: churnAcumulado(vidas, mes, 3),
    churn6m: churnAcumulado(vidas, mes, 6),
    ltv: ltvMedio(vidas, hoje),
    motivos: rankingMotivos(vidas),
  }
}

// --- Aquisição / CAC por canal e relação LTV/CAC (quick-260720-pev) ---

export type InvestimentoAquisicaoRow = {
  id: string
  canal: string
  competencia: string
  valor: string
  notas: string | null
}

/**
 * UPSERT do investimento em aquisição por (canal, competência) — o índice único
 * ux_invest_canal_competencia garante 1 lançamento por canal/mês. Reeditar o
 * mesmo canal/mês sobrescreve valor/notas em vez de duplicar.
 */
export async function createInvestimentoAquisicao(input: InvestimentoAquisicaoInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const parsed = investimentoAquisicaoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const { canal, competencia, valor, notas } = parsed.data

  let linha: InvestimentoAquisicaoRow
  try {
    const [row] = await db
      .insert(investimentosAquisicao)
      .values({
        canal,
        competencia,
        valor: valor.toFixed(2),
        notas: notas ?? null,
      })
      .onConflictDoUpdate({
        target: [investimentosAquisicao.canal, investimentosAquisicao.competencia],
        set: { valor: valor.toFixed(2), notas: notas ?? null, updatedAt: new Date() },
      })
      // Retorna a linha (inserida OU atualizada) para o cliente refletir na hora,
      // SEM router.refresh() da página pesada (debug 260721).
      .returning({
        id: investimentosAquisicao.id,
        canal: investimentosAquisicao.canal,
        competencia: investimentosAquisicao.competencia,
        valor: investimentosAquisicao.valor,
        notas: investimentosAquisicao.notas,
      })
    linha = row
  } catch (e) {
    // Migration 0039 pendente (tabela ausente) ou soluço de conexão.
    console.error('[createInvestimentoAquisicao]', e)
    return { error: 'Não foi possível salvar. Aplique a migration 0039 e tente novamente.' }
  }

  revalidatePath('/financeiro')
  return { data: { linha } }
}

/** Histórico de lançamentos (competência desc) para a tela de Aquisição. */
export async function listInvestimentosAquisicao(): Promise<InvestimentoAquisicaoRow[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    return await db
      .select({
        id: investimentosAquisicao.id,
        canal: investimentosAquisicao.canal,
        competencia: investimentosAquisicao.competencia,
        valor: investimentosAquisicao.valor,
        notas: investimentosAquisicao.notas,
      })
      .from(investimentosAquisicao)
      .orderBy(desc(investimentosAquisicao.competencia))
  } catch (e) {
    // Migration 0039 pendente — a tela mostra aviso, não erro.
    console.error('[listInvestimentosAquisicao]', e)
    return []
  }
}

/**
 * Apaga UM lançamento de investimento em aquisição por id. O CAC/LTV-CAC da
 * Visão Analítica recomputa sozinho na próxima leitura (não há dado derivado
 * persistido). Usado para remover lançamentos de teste feitos à mão.
 */
export async function deleteInvestimentoAquisicao(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  try {
    await db.delete(investimentosAquisicao).where(eq(investimentosAquisicao.id, id))
  } catch (e) {
    console.error('[deleteInvestimentoAquisicao]', e)
    return { error: 'Não foi possível excluir o lançamento.' }
  }

  revalidatePath('/financeiro')
  return { data: { ok: true } }
}

export type CacAquisicaoData = {
  /** Mês de referência 'YYYY-MM' (hoje em Brasília). */
  mes: string
  porCanalMes: ResultadoCac
  porCanal3m: ResultadoCac
  porCanal6m: ResultadoCac
  ltvCac: {
    ltv: number | null
    cacGeral: number | null
    /** LTV ÷ CAC geral; null quando um dos dois é indefinido. */
    relacao: number | null
  }
}

/**
 * CAC por canal (mês + acumulado 3m/6m) e relação LTV/CAC — padrão IDÊNTICO ao
 * getVisaoExecutiva: leitura da tabela nova em try/catch (ausente = migration
 * 0039 pendente → return null, a UI degrada com aviso), depois queries
 * SEQUENCIAIS (pool max=5 — NUNCA dentro do Promise.all da página) e TODO o
 * cálculo delegado ao módulo puro src/lib/financeiro/cac.ts.
 *
 * Independente da migration 0038: não lê clientes.data_encerramento (o LTV usado
 * aqui aproxima a vida dos encerrados até hoje). O CAC só depende da 0039.
 */
export async function getCacAquisicao(): Promise<CacAquisicaoData | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  let investimentos: InvestimentoCanal[]
  try {
    const linhas = await db
      .select({
        canal: investimentosAquisicao.canal,
        competencia: investimentosAquisicao.competencia,
        valor: investimentosAquisicao.valor,
      })
      .from(investimentosAquisicao)
    investimentos = linhas.map((l) => ({
      canal: l.canal,
      competencia: l.competencia,
      valor: Number(l.valor),
    }))
  } catch (e) {
    // Migration 0039 pendente (undefined_table) ou soluço de conexão.
    console.error('[getCacAquisicao]', e)
    return null
  }

  // SEQUENCIAL: clientes (origem + entrada na base) — sem data_encerramento
  // para não acoplar à migration 0038.
  const linhasClientes = await db
    .select({
      id: clientes.id,
      status: clientes.status,
      origemCliente: clientes.origemCliente,
      createdAt: clientes.createdAt,
    })
    .from(clientes)
    // CAC é do negócio — o perfil interno (agência) não conta como cliente ganho.
    .where(eq(clientes.interno, false))

  // SEQUENCIAL: primeiro contrato (min data_inicio) e ticket do contrato mais
  // recente por cliente — mesma leitura de getVisaoExecutiva.
  const linhasContratos = await db
    .select({
      clienteId: contratos.clienteId,
      inicio: sql<string>`min(${contratos.dataInicio})`,
      ticket: sql<string>`(array_agg(${contratos.valorMensal} order by ${contratos.dataInicio} desc))[1]`,
    })
    .from(contratos)
    .groupBy(contratos.clienteId)

  const porCliente = new Map(linhasContratos.map((c) => [c.clienteId, c]))

  // SEQUENCIAL (fora de qualquer Promise.all — regra do pool max=5): origem
  // ESTRUTURADA do CRM por cliente, para atribuir o canal do CAC pela origem
  // do CRM antes de cair na reserva do texto livre (resolverCanalCliente).
  // try/catch de degradação graciosa: se as tabelas/colunas do CRM não
  // existirem (migrations pendentes), seguimos com mapas vazios → 100% reserva.
  const origemOppPorCliente = new Map<string, string | null>()
  const origemContatoPorCliente = new Map<string, string | null>()
  try {
    // Oportunidade MAIS RECENTE por cliente (updatedAt desc, createdAt desc).
    const linhasOpp = await db
      .select({
        clienteId: crmOportunidades.clienteId,
        origem: sql<
          string | null
        >`(array_agg(${crmOportunidades.origem} order by ${crmOportunidades.updatedAt} desc, ${crmOportunidades.createdAt} desc))[1]`,
      })
      .from(crmOportunidades)
      .where(isNotNull(crmOportunidades.clienteId))
      .groupBy(crmOportunidades.clienteId)
    for (const l of linhasOpp) {
      if (l.clienteId) origemOppPorCliente.set(l.clienteId, l.origem)
    }

    // Contato MAIS RECENTE vinculado por cliente (mesma decisão temporal).
    const linhasContato = await db
      .select({
        clienteId: crmContatos.clienteId,
        origem: sql<
          string | null
        >`(array_agg(${crmContatos.origem} order by ${crmContatos.updatedAt} desc, ${crmContatos.createdAt} desc))[1]`,
      })
      .from(crmContatos)
      .where(isNotNull(crmContatos.clienteId))
      .groupBy(crmContatos.clienteId)
    for (const l of linhasContato) {
      if (l.clienteId) origemContatoPorCliente.set(l.clienteId, l.origem)
    }
  } catch (e) {
    // CRM ausente (migrations pendentes) → cai 100% na reserva de texto livre.
    console.error('[getCacAquisicao] origem CRM indisponível', e)
  }

  const clientesGanhos: ClienteGanho[] = linhasClientes.map((c) => {
    const contrato = porCliente.get(c.id)
    // Cadeia de vínculo: oportunidade primeiro, senão contato, senão null.
    const origemCrm =
      origemOppPorCliente.get(c.id) ?? origemContatoPorCliente.get(c.id) ?? null
    return {
      origem: c.origemCliente,
      origemCrm,
      inicio: contrato?.inicio ?? c.createdAt.toISOString().slice(0, 10),
    }
  })

  // LTV reusando o módulo executiva (data_encerramento = null aqui: vida dos
  // encerrados aproximada até hoje — CAC permanece independente da 0038).
  const vidas: ClienteVida[] = linhasClientes.map((c) => {
    const contrato = porCliente.get(c.id)
    return {
      id: c.id,
      status: c.status,
      inicio: contrato?.inicio ?? c.createdAt.toISOString().slice(0, 10),
      dataEncerramento: null,
      motivoEncerramento: null,
      ticketMensal: contrato?.ticket != null ? Number(contrato.ticket) : null,
    }
  })

  const hoje = hojeBrasilia()
  const mes = hoje.slice(0, 7)

  const porCanalMes = cacPorCanal(investimentos, clientesGanhos, mes)
  const porCanal3m = cacAcumulado(investimentos, clientesGanhos, mes, 3)
  const porCanal6m = cacAcumulado(investimentos, clientesGanhos, mes, 6)
  const ltv = ltvMedio(vidas, hoje)
  const ltvValor = ltv?.valor ?? null

  return {
    mes,
    porCanalMes,
    porCanal3m,
    porCanal6m,
    ltvCac: {
      ltv: ltvValor,
      cacGeral: porCanalMes.cacGeral,
      relacao: relacaoLtvCac(ltvValor, porCanalMes.cacGeral),
    },
  }
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

  // 4. Clientes ativos (exclui o perfil interno da agência).
  const [cliRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(clientes)
    .where(and(eq(clientes.status, 'ativo'), eq(clientes.interno, false)))
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
