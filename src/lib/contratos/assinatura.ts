// Efeito compartilhado "contrato assinado" — usado tanto pela action
// atualizarStatusAssinatura (botão manual) quanto pelo webhook da Autentique.
// Módulo server em lib (NÃO 'use server').

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos, clientes } from '@/lib/db/schema'

/**
 * Marca o contrato como assinado e ATIVA o cliente. Dois updates SEQUENCIAIS
 * (nunca Promise.all — pool max=3, memória do projeto). Idempotente: rodar
 * duas vezes não muda o resultado.
 */
export async function confirmarAssinatura(contratoId: string, clienteId: string): Promise<void> {
  await db
    .update(contratos)
    .set({ statusFluxo: 'assinado', assinadoEm: new Date() })
    .where(eq(contratos.id, contratoId))

  await db.update(clientes).set({ status: 'ativo' }).where(eq(clientes.id, clienteId))
}
