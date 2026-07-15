import { db } from '@/lib/db'
import { crmAtividades } from '@/lib/db/schema'

// Módulo server comum — SEM 'use server': é helper interno das actions e do
// ingest, não um endpoint. (Exportá-lo de um arquivo 'use server' o exporia
// como action chamável de fora.)

export type EntradaAtividadeCrm = {
  tipo: string
  oportunidadeId?: string | null
  contatoId?: string | null
  empresaId?: string | null
  campo?: string
  de?: string | null
  para?: string | null
  detalhe?: string | null
}

/**
 * Grava uma linha na timeline do CRM (crm_atividades).
 * ⚠️ O log de atividade NUNCA pode derrubar a mutação que ele registra — nem
 * quando a 0019 ainda não foi aplicada. Por isso o try/catch só loga.
 * `autor` null = automação → autorNome 'Sistema' (denormalizado, sem join na leitura).
 */
export async function registrarAtividadeCrm(
  workspaceId: string,
  autor: { id: string; nome: string } | null,
  entrada: EntradaAtividadeCrm
) {
  try {
    await db.insert(crmAtividades).values({
      workspaceId,
      oportunidadeId: entrada.oportunidadeId ?? null,
      contatoId: entrada.contatoId ?? null,
      empresaId: entrada.empresaId ?? null,
      tipo: entrada.tipo,
      autorId: autor?.id ?? null,
      autorNome: autor?.nome ?? 'Sistema',
      campo: entrada.campo ?? null,
      de: entrada.de ?? null,
      para: entrada.para ?? null,
      detalhe: entrada.detalhe ?? null,
    })
  } catch (e) {
    console.error('[registrarAtividadeCrm]', e)
  }
}
