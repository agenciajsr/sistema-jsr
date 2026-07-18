// Gera o checklist de um processo (onboarding/retenção) para um cliente a
// partir do MODELO vigente. Vive fora de 'use server' para ser chamado tanto
// pelas actions quanto pelos webhooks (Asaas/Autentique) sem sessão.
//
// Idempotente: se o cliente já tem itens do tipo, não faz nada — ativação
// dupla (webhook + baixa manual) nunca duplica o checklist. try/catch que SÓ
// loga: gerar checklist NUNCA pode quebrar o fluxo de ativação do cliente.

import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { processoItens, processoModeloItens } from '@/lib/db/schema'

export type TipoProcesso = 'onboarding' | 'retencao'

/** @returns quantos itens foram criados (0 = já existia ou modelo vazio). */
export async function gerarProcessoParaCliente(
  clienteId: string,
  tipo: TipoProcesso,
): Promise<number> {
  try {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(processoItens)
      .where(and(eq(processoItens.clienteId, clienteId), eq(processoItens.tipo, tipo)))
    if (total > 0) return 0

    const modelo = await db
      .select({
        titulo: processoModeloItens.titulo,
        ordem: processoModeloItens.ordem,
        opcional: processoModeloItens.opcional,
      })
      .from(processoModeloItens)
      .where(and(eq(processoModeloItens.tipo, tipo), eq(processoModeloItens.ativo, true)))
      .orderBy(asc(processoModeloItens.ordem))
    if (modelo.length === 0) return 0

    await db.insert(processoItens).values(
      modelo.map((m) => ({
        clienteId,
        tipo,
        titulo: m.titulo,
        ordem: m.ordem,
        opcional: m.opcional,
      })),
    )
    return modelo.length
  } catch (e) {
    console.error('[gerarProcessoParaCliente] falha (migration 0035 pendente?) — ignorando', e)
    return 0
  }
}
