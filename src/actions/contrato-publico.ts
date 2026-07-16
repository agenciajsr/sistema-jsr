'use server'

// ⚠️ ACTION PÚBLICA (sem getCurrentUser) — o cliente da agência preenche os
// dados do contrato pelo link /contrato/[token] SEM login. A segurança é o
// próprio token (256 bits imprevisíveis, unique no banco). Nunca vazar erro
// técnico: toda falha vira mensagem genérica em português.

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos } from '@/lib/db/schema'
import { contratanteSchema, type ContratanteInput } from '@/lib/validations/contratante'

const ERRO_GENERICO = 'Não foi possível enviar os dados. Tente novamente em instantes.'
const ERRO_TOKEN = 'Link inválido ou expirado — fale com a equipe JSR.'

export async function salvarDadosContratante(token: string, dados: ContratanteInput) {
  if (!token || typeof token !== 'string') return { error: ERRO_TOKEN }

  // Validação SERVER-SIDE obrigatória — mesmo schema do formulário.
  const parsed = contratanteSchema.safeParse(dados)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos. Revise o formulário.' }
  }

  try {
    const [contrato] = await db
      .select({ id: contratos.id, statusFluxo: contratos.statusFluxo })
      .from(contratos)
      .where(eq(contratos.token, token))

    if (!contrato || !contrato.statusFluxo) return { error: ERRO_TOKEN }

    // Idempotente: reenvio sobrescreve o jsonb. Se o fluxo já avançou
    // (aguardando_assinatura/assinado — Parte 2), ainda aceitamos a correção
    // dos dados, mas NUNCA regredimos o status.
    const statusAvancado =
      contrato.statusFluxo === 'aguardando_assinatura' || contrato.statusFluxo === 'assinado'

    await db
      .update(contratos)
      .set({
        dadosContratante: parsed.data,
        statusFluxo: statusAvancado ? contrato.statusFluxo : 'dados_recebidos',
        dadosRecebidosEm: new Date(),
      })
      .where(eq(contratos.id, contrato.id))

    return { data: { ok: true } }
  } catch (e) {
    console.error('[salvarDadosContratante]', e)
    return { error: ERRO_GENERICO }
  }
}
