// Materialização preguiçosa idempotente das transações recorrentes do
// financeiro — espelho de src/lib/cobrancas/gerar.ts (gerarCobrancasMensais).
// Módulo SERVER comum, SEM 'use server' (todo export de arquivo 'use server'
// vira endpoint chamável de fora).
//
// ⚠️ QUERIES SEQUENCIAIS, NUNCA PARALELAS. O pool é max=5 / max_pipeline=1
// (src/lib/db/index.ts): o Supavisor em transaction mode não pipeliniza —
// queries paralelas na mesma conexão penduram PARA SEMPRE. rolarRecorrentes é
// SEQUENCIAL e roda 1× FORA de qualquer Promise.all (nunca engordar os lotes da
// página /financeiro — debug 260721). Nº de queries fixo, não cresce com séries.

import { and, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { transacoes, contratos } from '@/lib/db/schema'
import { hojeBrasilia } from '@/lib/date-br'
import { datasPendentesRecorrentes, type RecorrenciaFin } from '@/lib/financeiro/recorrencia'

/**
 * Materializa a(s) competência(s) pendente(s) de cada série recorrente até HOJE
 * (a próxima nasce pelo CALENDÁRIO, como as cobranças). Idempotente: o filtro
 * `jaGeradas` (datas já no banco + a própria âncora) evita duplicar, e o índice
 * único (transacao_pai_id, data) da migration 0041 é a trava final de corrida.
 *
 * Degradação graciosa: qualquer falha (migration ausente, soluço de conexão)
 * loga e retorna { criadas: 0 } — NUNCA quebra o caller (cron ou página).
 */
export async function rolarRecorrentes(): Promise<{ criadas: number }> {
  try {
    const hoje = hojeBrasilia()

    // 1. Âncoras da série (1ª competência real): sem pai e com recorrência.
    const ancoras = await db
      .select({
        id: transacoes.id,
        tipo: transacoes.tipo,
        categoria: transacoes.categoria,
        clienteId: transacoes.clienteId,
        descricao: transacoes.descricao,
        valor: transacoes.valor,
        data: transacoes.data,
        diaVencto: transacoes.diaVencto,
        notas: transacoes.notas,
        centroCusto: transacoes.centroCusto,
        recorrencia: transacoes.recorrencia,
        formaPagamento: transacoes.formaPagamento,
        responsavelId: transacoes.responsavelId,
      })
      .from(transacoes)
      .where(and(isNull(transacoes.transacaoPaiId), ne(transacoes.recorrencia, 'avulsa')))

    if (ancoras.length === 0) return { criadas: 0 }

    const ancoraIds = ancoras.map((a) => a.id)

    // 2. SEQUENCIAL: filhos já existentes de cada série → datas já geradas.
    //    A própria âncora entra na lista (é a 1ª competência).
    const filhos = await db
      .select({ transacaoPaiId: transacoes.transacaoPaiId, data: transacoes.data })
      .from(transacoes)
      .where(inArray(transacoes.transacaoPaiId, ancoraIds))

    const jaGeradasPorAncora = new Map<string, string[]>()
    for (const a of ancoras) jaGeradasPorAncora.set(a.id, [a.data])
    for (const f of filhos) {
      if (!f.transacaoPaiId) continue
      const lista = jaGeradasPorAncora.get(f.transacaoPaiId)
      if (lista) lista.push(f.data)
    }

    // 3. SEQUENCIAL: dataFinal por cliente = contrato VIGENTE hoje → max
    //    dataVencimento (agregada em UMA query). Âncora sem cliente → null.
    const clienteIds = [...new Set(ancoras.map((a) => a.clienteId).filter((v): v is string => !!v))]
    const dataFinalPorCliente = new Map<string, string>()
    if (clienteIds.length > 0) {
      const vigentes = await db
        .select({
          clienteId: contratos.clienteId,
          dataFinal: sql<string>`max(${contratos.dataVencimento})`,
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
      for (const v of vigentes) dataFinalPorCliente.set(v.clienteId, v.dataFinal)
    }

    // 4. Por âncora: acumula as competências pendentes copiando os campos.
    const linhas: (typeof transacoes.$inferInsert)[] = []
    for (const ancora of ancoras) {
      const dataFinal = ancora.clienteId ? (dataFinalPorCliente.get(ancora.clienteId) ?? null) : null
      const pendentes = datasPendentesRecorrentes({
        dataBase: ancora.data,
        recorrencia: ancora.recorrencia as RecorrenciaFin,
        dataFinal,
        jaGeradas: jaGeradasPorAncora.get(ancora.id) ?? [ancora.data],
        hoje,
      })
      for (const data of pendentes) {
        linhas.push({
          tipo: ancora.tipo,
          categoria: ancora.categoria,
          clienteId: ancora.clienteId,
          descricao: ancora.descricao,
          valor: ancora.valor,
          data,
          status: 'pendente',
          diaVencto: ancora.diaVencto,
          notas: ancora.notas,
          centroCusto: ancora.centroCusto,
          recorrencia: ancora.recorrencia,
          formaPagamento: ancora.formaPagamento,
          responsavelId: ancora.responsavelId,
          transacaoPaiId: ancora.id,
        })
      }
    }

    if (linhas.length === 0) return { criadas: 0 }

    // 5. UM insert em lote. onConflictDoNothing sobre o índice único
    //    (transacao_pai_id, data) da migration 0041 é a trava de corrida; antes
    //    de a 0041 existir, a idempotência já é garantida pelo filtro jaGeradas.
    const criadas = await db
      .insert(transacoes)
      .values(linhas)
      .onConflictDoNothing()
      .returning({ id: transacoes.id })

    return { criadas: criadas.length }
  } catch (e) {
    // Migration ausente / soluço de conexão nunca quebra o caller.
    console.error('[rolarRecorrentes]', e)
    return { criadas: 0 }
  }
}
