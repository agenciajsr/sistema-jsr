/**
 * Motor de persistência dos alertas proativos.
 *
 * Chamado pelo cron diário (sync-meta) e pela ação manual "Reavaliar agora".
 * Compara os alertas calculados on-the-fly com o que está gravado na tabela
 * `alertas` (identidade = chaveDedup, o id estável que os avaliadores já
 * produzem) e aplica o ciclo de vida:
 *
 *   - chave nova            → INSERT com status 'novo'
 *   - chave aberta          → UPDATE dos campos, PRESERVANDO o status
 *   - chave resolvida       → REABRE ('novo', detectadoEm agora, resolvidoEm nulo)
 *   - aberta que sumiu      → resolve automaticamente ('resolvido' + resolvidoEm)
 */

import { eq, ne, and, inArray, notInArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { alertas } from '@/lib/db/schema'
import { calcularAlertasAtuais } from './calcular'

export interface ResumoAvaliacao {
  novos: number
  atualizados: number
  reabertos: number
  resolvidos: number
}

export async function avaliarEPersistirAlertas(): Promise<ResumoAvaliacao> {
  const calculados = await calcularAlertasAtuais()
  const chaves = calculados.map((a) => a.id)
  const agora = new Date()

  // Linhas existentes para as chaves calculadas (única linha por chaveDedup,
  // garantido pelo uniqueIndex) — decide entre INSERT, UPDATE e REABRIR.
  const existentes = chaves.length > 0
    ? await db
        .select({
          id: alertas.id,
          chaveDedup: alertas.chaveDedup,
          status: alertas.status,
        })
        .from(alertas)
        .where(inArray(alertas.chaveDedup, chaves))
    : []
  const porChave = new Map(existentes.map((r) => [r.chaveDedup, r]))

  let novos = 0
  let atualizados = 0
  let reabertos = 0

  for (const alerta of calculados) {
    // O tipo Alerta usa '' quando não há cliente — no banco isso vira null
    const clienteId = alerta.clienteId === '' ? null : alerta.clienteId
    const existente = porChave.get(alerta.id)

    if (!existente) {
      // Alerta inédito → entra como 'novo'
      await db.insert(alertas).values({
        tipo: alerta.tipo,
        clienteId,
        clienteNome: alerta.clienteNome,
        titulo: alerta.titulo,
        detalhe: alerta.detalhe,
        severidade: alerta.severidade,
        status: 'novo',
        chaveDedup: alerta.id,
        dataRelevante: alerta.dataRelevante,
        detectadoEm: agora,
      })
      novos++
    } else if (existente.status === 'resolvido') {
      // O problema voltou → reabre como 'novo'
      await db
        .update(alertas)
        .set({
          tipo: alerta.tipo,
          clienteId,
          clienteNome: alerta.clienteNome,
          titulo: alerta.titulo,
          detalhe: alerta.detalhe,
          severidade: alerta.severidade,
          status: 'novo',
          dataRelevante: alerta.dataRelevante,
          detectadoEm: agora,
          resolvidoEm: null,
          updatedAt: agora,
        })
        .where(eq(alertas.id, existente.id))
      reabertos++
    } else {
      // Já aberto ('novo' ou 'lido') → atualiza os campos PRESERVANDO o status
      // (quem marcou como lido não volta a ver o mesmo alerta como novo)
      await db
        .update(alertas)
        .set({
          tipo: alerta.tipo,
          clienteId,
          clienteNome: alerta.clienteNome,
          titulo: alerta.titulo,
          detalhe: alerta.detalhe,
          severidade: alerta.severidade,
          dataRelevante: alerta.dataRelevante,
          updatedAt: agora,
        })
        .where(eq(alertas.id, existente.id))
      atualizados++
    }
  }

  // Resolução automática: alertas abertos no banco cuja chave NÃO apareceu
  // na avaliação atual → o problema deixou de existir.
  const condicaoAberto = ne(alertas.status, 'resolvido')
  const resolvidosRows = await db
    .update(alertas)
    .set({ status: 'resolvido', resolvidoEm: agora, updatedAt: agora })
    .where(
      chaves.length > 0
        ? and(condicaoAberto, notInArray(alertas.chaveDedup, chaves))
        : condicaoAberto,
    )
    .returning({ id: alertas.id })

  return { novos, atualizados, reabertos, resolvidos: resolvidosRows.length }
}
