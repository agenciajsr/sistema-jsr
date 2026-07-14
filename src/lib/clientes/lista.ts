import { eq, and, asc, sql, lte, gte, isNotNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clientes,
  profiles,
  contratos,
  transacoes,
  alertas,
  adAccounts,
  campaignInsights,
} from '@/lib/db/schema'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'
import { montarLinhas, type ClienteLinha, type BaseRow } from '@/lib/clientes/agregar'

// Módulo server comum — SEM 'use server': é chamado direto pelo Server Component
// da página, não pelo client. Evita expor um endpoint desnecessário.
//
// ⚠️ QUERIES SEQUENCIAIS, NUNCA PARALELAS (nada de paralelizar com Promise).
// O pool é max=3 com max_pipeline=0 (src/lib/db/index.ts): o Supavisor em
// transaction mode não suporta pipelining — queries paralelas na mesma conexão
// penduram PARA SEMPRE (nem o statement_timeout dispara). Isto foi a causa raiz
// dos travamentos corrigidos nos quicks 260713-usi e 260714-ita. São 6 queries
// AGREGADAS (não N+1: o número de queries não cresce com o número de clientes)
// e o merge acontece em memória, em agregar.ts.

export async function getClientesLista(): Promise<ClienteLinha[]> {
  try {
    // "Hoje" SEMPRE via hojeBrasilia(): o relógio cru do server roda em UTC na
    // Vercel e viraria o dia a partir das 21h BR. Datas comparadas como string ISO.
    const hoje = hojeBrasilia()
    const ha30dias = dataMenosDias(30)

    // 1. Base — a lista de clientes manda; os agregados só enriquecem.
    const base: BaseRow[] = await db
      .select({
        id: clientes.id,
        nome: clientes.nome,
        status: clientes.status,
        createdAt: clientes.createdAt,
        responsavelNome: profiles.nome,
      })
      .from(clientes)
      .leftJoin(profiles, eq(clientes.gestorId, profiles.id))
      .orderBy(asc(clientes.nome))

    // 2. Mensalidade — soma dos contratos vigentes hoje.
    const mensalidades = await db
      .select({
        clienteId: contratos.clienteId,
        valor: sql<string>`sum(${contratos.valorMensal})`,
      })
      .from(contratos)
      .where(and(lte(contratos.dataInicio, hoje), gte(contratos.dataVencimento, hoje)))
      .groupBy(contratos.clienteId)

    // 3. Início do relacionamento — contrato mais antigo (base do LT).
    const inicios = await db
      .select({
        clienteId: contratos.clienteId,
        inicio: sql<string>`min(${contratos.dataInicio})`,
      })
      .from(contratos)
      .groupBy(contratos.clienteId)

    // 4. LTV — receita paga acumulada.
    const ltvs = await db
      .select({
        clienteId: transacoes.clienteId,
        total: sql<string>`sum(${transacoes.valor})`,
      })
      .from(transacoes)
      .where(
        and(
          eq(transacoes.tipo, 'receita'),
          eq(transacoes.status, 'pago'),
          isNotNull(transacoes.clienteId)
        )
      )
      .groupBy(transacoes.clienteId)

    // 5. Alertas abertos.
    const alertasPorCliente = await db
      .select({
        clienteId: alertas.clienteId,
        total: sql<number>`count(*)::int`,
      })
      .from(alertas)
      .where(and(eq(alertas.status, 'novo'), isNotNull(alertas.clienteId)))
      .groupBy(alertas.clienteId)

    // 6. Investimento dos últimos 30 dias.
    const investimentos = await db
      .select({
        clienteId: adAccounts.clienteId,
        total: sql<string>`sum(${campaignInsights.spend})`,
      })
      .from(campaignInsights)
      .innerJoin(adAccounts, eq(campaignInsights.adAccountId, adAccounts.id))
      .where(
        and(
          gte(campaignInsights.date, ha30dias),
          lte(campaignInsights.date, hoje),
          isNotNull(adAccounts.clienteId)
        )
      )
      .groupBy(adAccounts.clienteId)

    // Nenhuma matemática mora aqui — só I/O. O merge é do módulo puro.
    return montarLinhas(base, mensalidades, inicios, ltvs, alertasPorCliente, investimentos, hoje)
  } catch (e) {
    // Nunca lança: a página degrada para o estado vazio em vez de quebrar.
    console.error('[getClientesLista]', e)
    return []
  }
}
