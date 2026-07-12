import { eq, and, sql, gte, desc, count } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights, clientes, contratos, transacoes, acompanhamentos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getResumoCliente, listarClientesComContas, parseActions, type Nicho, type ChaveHeroi, metricaHeroi } from '@/lib/trafego/aggregate'

export type DashboardKpis = {
  mrr: number
  receitaMes: number
  despesaMes: number
  lucroMes: number
  clientesAtivos: number
  campanhasAtivas: number
  conversasTotais: number
}

export type ClientePerformance = {
  id: string
  nome: string
  nicho: Nicho
  investimento: number
  resultadoHeroi: number
  labelHeroi: string
  cpa: number | null
  roas: number | null
  impressions: number
  clicks: number
  ctr: number | null
  cpm: number | null
  serieSpendPorDia: { date: string; spend: number }[]
}

export type AtividadeItem = {
  id: string
  titulo: string
  sub: string
  tempo: Date
  tipo: 'cliente' | 'pagamento'
}

export type ResumoFinanceiroDash = {
  receita: number
  despesa: number
  lucro: number
  mrrAtual: number
  percentRecebido: number
}

export type DashboardData = {
  kpis: DashboardKpis
  clientesPerformance: ClientePerformance[]
  financeiro: ResumoFinanceiroDash
  atividadeRecente: AtividadeItem[]
}

/**
 * Busca todos os dados reais para o dashboard.
 * Nunca lança — retorna dados zerados se algo falhar.
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const agora = new Date()
  const mes = agora.getMonth() + 1
  const ano = agora.getFullYear()
  const hoje = agora.toISOString().slice(0, 10)

  // Queries paralelas para performance
  const [
    mrrResult,
    finResult,
    clientesAtivosResult,
    campanhasResult,
    clientesComContas,
    atividadeResult,
  ] = await Promise.all([
    // MRR: soma de contratos ativos
    db.select({
      total: sql<string>`coalesce(sum(${contratos.valorMensal}), '0')`,
    })
      .from(contratos)
      .where(and(
        sql`${contratos.dataInicio} <= ${hoje}`,
        sql`${contratos.dataVencimento} >= ${hoje}`,
      )),

    // Financeiro do mês — só transações com status 'pago' contam como recebimento
    db.select({
      receita: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
      despesa: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
    })
      .from(transacoes)
      .where(and(
        sql`extract(month from ${transacoes.data}::date) = ${mes}`,
        sql`extract(year from ${transacoes.data}::date) = ${ano}`,
      )),

    // Clientes ativos
    db.select({ total: count() })
      .from(clientes)
      .where(eq(clientes.status, 'ativo')),

    // Campanhas ativas (distinct campaign_id nos últimos 7 dias)
    db.select({
      total: sql<string>`count(distinct ${campaignInsights.campaignId})`,
    })
      .from(campaignInsights)
      .where(gte(campaignInsights.date, new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))),

    // Clientes com contas (para performance)
    listarClientesComContas(),

    // Atividade recente: últimos acompanhamentos + transações recentes
    db.select({
      id: acompanhamentos.id,
      clienteId: acompanhamentos.clienteId,
      autorNome: acompanhamentos.autorNome,
      nota: acompanhamentos.nota,
      createdAt: acompanhamentos.createdAt,
    })
      .from(acompanhamentos)
      .orderBy(desc(acompanhamentos.createdAt))
      .limit(4),
  ])

  const mrr = Number(mrrResult[0]?.total ?? 0)
  const receita = Number(finResult[0]?.receita ?? 0)
  const despesa = Number(finResult[0]?.despesa ?? 0)
  const lucro = receita - despesa
  const clientesAtivos = clientesAtivosResult[0]?.total ?? 0
  const campanhasAtivas = Number(campanhasResult[0]?.total ?? 0)

  // Conversas totais (últimos 7 dias, todos os clientes)
  let conversasTotais = 0

  // Performance por cliente (top clientes com contas)
  const clientesPerformance: ClientePerformance[] = []

  for (const c of clientesComContas.slice(0, 10)) {
    try {
      const resumo = await getResumoCliente(c.id, '30d')
      if (!resumo || !resumo.temDados) continue

      const heroi = metricaHeroi(c.nicho)
      const resultado = heroi.chave === 'vendas'
        ? resumo.totais.vendas
        : heroi.chave === 'conversas'
          ? resumo.totais.conversas
          : resumo.totais.leads

      conversasTotais += resumo.totais.conversas

      clientesPerformance.push({
        id: c.id,
        nome: c.nome,
        nicho: c.nicho,
        investimento: resumo.totais.spend,
        resultadoHeroi: resultado,
        labelHeroi: heroi.label,
        cpa: resumo.derivadas.custoPorResultadoHeroi,
        roas: resumo.roas,
        impressions: resumo.totais.impressions,
        clicks: resumo.totais.clicks,
        ctr: resumo.derivadas.ctr,
        cpm: resumo.derivadas.cpm,
        serieSpendPorDia: resumo.serieSpendPorDia,
      })
    } catch {
      // Cliente sem dados ou erro de query — continuar com os demais
      continue
    }
  }

  // Atividade recente formatada
  const atividadeRecente: AtividadeItem[] = atividadeResult.map((a) => ({
    id: a.id,
    titulo: `Acompanhamento por ${a.autorNome}`,
    sub: a.nota.slice(0, 60) + (a.nota.length > 60 ? '...' : ''),
    tempo: a.createdAt,
    tipo: 'cliente' as const,
  }))

  return {
    kpis: {
      mrr,
      receitaMes: receita,
      despesaMes: despesa,
      lucroMes: lucro,
      clientesAtivos,
      campanhasAtivas,
      conversasTotais,
    },
    clientesPerformance,
    financeiro: {
      receita,
      despesa,
      lucro,
      mrrAtual: mrr,
      percentRecebido: mrr > 0 ? Math.round((receita / mrr) * 100) : 0,
    },
    atividadeRecente,
  }
}
