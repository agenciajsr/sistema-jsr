// Efeito compartilhado "contrato assinado" — usado tanto pela action
// atualizarStatusAssinatura (botão manual) quanto pelo webhook da Autentique.
// Módulo server em lib (NÃO 'use server').

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos, clientes } from '@/lib/db/schema'
import { gerarPrimeiraCobranca } from '@/lib/cobrancas/gerar'
import { gerarProcessoParaCliente } from '@/lib/processos/gerar'

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

  // Fase 6: cliente ativado ganha o checklist de onboarding (idempotente,
  // nunca quebra a ativação — o helper já engole falhas).
  await gerarProcessoParaCliente(clienteId, 'onboarding')

  // Fase 5: contrato assinado dispara a 1ª cobrança. Falha aqui NUNCA bloqueia
  // a ativação (D-05) — sem env do Asaas a fatura local nasce mesmo assim; se
  // nem isso der, o cron (carona no sync-meta) e o botão manual cobrem.
  try {
    await gerarPrimeiraCobranca(contratoId)
  } catch (erro) {
    console.warn(
      `[assinatura] contrato ${contratoId} assinado e cliente ativado, mas a 1ª cobrança falhou — o cron ou o botão manual em /contratos cobrem.`,
      erro,
    )
  }
}
