// Carimbo do 1º contato do CRM (crm_oportunidades.primeiro_contato_em).
//
// Vive FORA dos arquivos 'use server' para poder ser importado por qualquer
// action sem virar server action exportada. Idempotente: o WHERE ... IS NULL
// garante que só o PRIMEIRO evento de contato conclui o carimbo.

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { crmOportunidades } from '@/lib/db/schema'

/**
 * Carimba primeiro_contato_em UMA única vez. try/catch que SÓ loga de
 * propósito: a coluna é da migration 0034 (aplicação manual) — o fluxo
 * principal NUNCA pode quebrar por causa do carimbo.
 */
export async function carimbarPrimeiroContato(oportunidadeId: string | null | undefined) {
  if (!oportunidadeId) return
  try {
    await db
      .update(crmOportunidades)
      .set({ primeiroContatoEm: new Date() })
      .where(
        and(eq(crmOportunidades.id, oportunidadeId), isNull(crmOportunidades.primeiroContatoEm)),
      )
  } catch (e) {
    console.error('[carimbarPrimeiroContato] falha (migration 0034 pendente?) — ignorando', e)
  }
}
