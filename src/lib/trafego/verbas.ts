import { eq, and, sql, gte, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights, clientes } from '@/lib/db/schema'

export type StatusVerba = 'ok' | 'atencao' | 'critico'

export type VerbaCliente = {
  clienteId: string
  clienteNome: string
  verbaMensal: number
  gastoMes: number
  percentual: number
  projecao: number
  status: StatusVerba
  serieDiaria: { date: string; spend: number }[]
}

export type VerbaResumo = Omit<VerbaCliente, 'serieDiaria'>

function calcularStatus(percentual: number, diaDoMes: number, diasNoMes: number): StatusVerba {
  const progressoIdeal = (diaDoMes / diasNoMes) * 100

  // Acima de 90% a qualquer momento = crítico
  if (percentual >= 90) return 'critico'

  // Acima de 80% antes de 2/3 do mês = atenção
  if (percentual > 80 && diaDoMes < diasNoMes * 0.67) return 'atencao'

  // Abaixo de 40% na segunda metade do mês = atenção (subgasto)
  if (percentual < 40 && diaDoMes > diasNoMes * 0.5) return 'atencao'

  // Ritmo muito acelerado (gasto > 130% do ideal para o ponto do mês)
  if (percentual > progressoIdeal * 1.3) return 'atencao'

  return 'ok'
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/**
 * Retorna o resumo de verba de todos os clientes que possuem verbaMensal configurada.
 */
export async function getVerbasTodosClientes(): Promise<VerbaResumo[]> {
  const agora = new Date()
  const mes = agora.getMonth() + 1
  const ano = agora.getFullYear()
  const dia = agora.getDate()
  const totalDias = diasNoMes(ano, mes)

  const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDias).padStart(2, '0')}`

  // Clientes com verba configurada
  const clientesComVerba = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      verbaMensal: clientes.verbaMensal,
    })
    .from(clientes)
    .where(and(
      eq(clientes.status, 'ativo'),
      sql`${clientes.verbaMensal} is not null and ${clientes.verbaMensal} > 0`,
    ))

  if (clientesComVerba.length === 0) return []

  // Para cada cliente, buscar gasto do mês
  const resultado: VerbaResumo[] = []

  for (const c of clientesComVerba) {
    const verba = Number(c.verbaMensal)

    // Contas de anúncio do cliente
    const contas = await db
      .select({ id: adAccounts.id })
      .from(adAccounts)
      .where(and(eq(adAccounts.clienteId, c.id), eq(adAccounts.ativo, true)))

    if (contas.length === 0) {
      resultado.push({
        clienteId: c.id,
        clienteNome: c.nome,
        verbaMensal: verba,
        gastoMes: 0,
        percentual: 0,
        projecao: 0,
        status: 'ok',
      })
      continue
    }

    const contaIds = contas.map((ct) => ct.id)

    const [gastoResult] = await db
      .select({
        total: sql<string>`coalesce(sum(${campaignInsights.spend}::numeric), 0)`,
      })
      .from(campaignInsights)
      .where(and(
        sql`${campaignInsights.adAccountId} in (${sql.join(contaIds.map(id => sql`${id}`), sql`,`)})`,
        gte(campaignInsights.date, primeiroDia),
        lte(campaignInsights.date, ultimoDia),
      ))

    const gastoMes = Number(gastoResult?.total ?? 0)
    const percentual = verba > 0 ? Math.round((gastoMes / verba) * 100) : 0
    const mediaDiaria = dia > 0 ? gastoMes / dia : 0
    const projecao = Math.round(mediaDiaria * totalDias)
    const status = calcularStatus(percentual, dia, totalDias)

    resultado.push({
      clienteId: c.id,
      clienteNome: c.nome,
      verbaMensal: verba,
      gastoMes,
      percentual,
      projecao,
      status,
    })
  }

  return resultado
}

/**
 * Retorna detalhe da verba de um cliente específico, incluindo série diária.
 */
export async function getVerbaCliente(clienteId: string): Promise<VerbaCliente | null> {
  const agora = new Date()
  const mes = agora.getMonth() + 1
  const ano = agora.getFullYear()
  const dia = agora.getDate()
  const totalDias = diasNoMes(ano, mes)

  const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = `${ano}-${String(mes).padStart(2, '0')}-${String(totalDias).padStart(2, '0')}`

  const [cliente] = await db
    .select({ id: clientes.id, nome: clientes.nome, verbaMensal: clientes.verbaMensal })
    .from(clientes)
    .where(eq(clientes.id, clienteId))

  if (!cliente || !cliente.verbaMensal) return null

  const verba = Number(cliente.verbaMensal)

  const contas = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(and(eq(adAccounts.clienteId, clienteId), eq(adAccounts.ativo, true)))

  if (contas.length === 0) {
    return {
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      verbaMensal: verba,
      gastoMes: 0,
      percentual: 0,
      projecao: 0,
      status: 'ok',
      serieDiaria: [],
    }
  }

  const contaIds = contas.map((ct) => ct.id)

  // Gasto total do mês
  const [gastoResult] = await db
    .select({
      total: sql<string>`coalesce(sum(${campaignInsights.spend}::numeric), 0)`,
    })
    .from(campaignInsights)
    .where(and(
      sql`${campaignInsights.adAccountId} in (${sql.join(contaIds.map(id => sql`${id}`), sql`,`)})`,
      gte(campaignInsights.date, primeiroDia),
      lte(campaignInsights.date, ultimoDia),
    ))

  // Série diária
  const serieRows = await db
    .select({
      date: campaignInsights.date,
      spend: sql<string>`sum(${campaignInsights.spend}::numeric)`,
    })
    .from(campaignInsights)
    .where(and(
      sql`${campaignInsights.adAccountId} in (${sql.join(contaIds.map(id => sql`${id}`), sql`,`)})`,
      gte(campaignInsights.date, primeiroDia),
      lte(campaignInsights.date, ultimoDia),
    ))
    .groupBy(campaignInsights.date)
    .orderBy(campaignInsights.date)

  const gastoMes = Number(gastoResult?.total ?? 0)
  const percentual = verba > 0 ? Math.round((gastoMes / verba) * 100) : 0
  const mediaDiaria = dia > 0 ? gastoMes / dia : 0
  const projecao = Math.round(mediaDiaria * totalDias)
  const status = calcularStatus(percentual, dia, totalDias)

  return {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    verbaMensal: verba,
    gastoMes,
    percentual,
    projecao,
    status,
    serieDiaria: serieRows.map((r) => ({
      date: r.date,
      spend: Number(r.spend),
    })),
  }
}
