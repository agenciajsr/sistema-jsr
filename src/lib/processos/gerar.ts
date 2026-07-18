// Gera o processo de um cliente (onboarding/retenção/saída) como uma TAREFA —
// fonte ÚNICA do checklist (quick 260718-gp5). Vive fora de 'use server' para
// ser chamado tanto pelas actions quanto pelos webhooks (Asaas/Autentique)
// sem sessão.
//
// A tarefa nasce com título "Onboarding — {nome}", prioridade alta, data de
// HOJE (fuso BR) e os itens do modelo como checklist (tarefa_checklist_items),
// agrupados pelo nome do processo. A idempotência usa a etiqueta técnica
// `processo:{tipo}` em tarefas.etiquetas (jsonb containment — sem migration):
// ativação dupla (webhook + baixa manual) nunca duplica a tarefa.
//
// `processo_itens` NÃO é mais escrito nem lido aqui (0 linhas em produção);
// a tabela permanece no schema, sem drop.
//
// try/catch que SÓ loga: gerar o processo NUNCA pode quebrar a ativação.

import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, processoModeloItens, tarefaChecklistItems, tarefas } from '@/lib/db/schema'

export type TipoProcesso = 'onboarding' | 'retencao' | 'saida'

// --- Helpers PUROS (testados em gerar.test.ts, sem banco) ---

const TITULO_PREFIXO: Record<TipoProcesso, string> = {
  onboarding: 'Onboarding',
  retencao: 'Retenção',
  saida: 'Encerramento',
}

/** 'Onboarding — {nome}' / 'Retenção — {nome}' / 'Encerramento — {nome}'. */
export function tituloDoProcesso(tipo: TipoProcesso, nome: string): string {
  return `${TITULO_PREFIXO[tipo]} — ${nome}`
}

/** Chave técnica ESTÁVEL de idempotência, gravada em tarefas.etiquetas. */
export function etiquetaDoProcesso(tipo: TipoProcesso): string {
  return `processo:${tipo}`
}

/** Nome legível do grupo do checklist (e o chip visível no card da tarefa). */
export function grupoDoProcesso(tipo: TipoProcesso): string {
  return TITULO_PREFIXO[tipo]
}

type ItemModelo = { titulo: string; ordem: number; opcional: boolean }

/** Modelo → itens do checklist. Opcional ganha sufixo ' (opcional)' no texto. */
export function itensParaChecklist(modelo: ItemModelo[]): { texto: string; ordem: number }[] {
  return modelo.map((m) => ({
    texto: m.opcional ? `${m.titulo} (opcional)` : m.titulo,
    ordem: m.ordem,
  }))
}

/** 'YYYY-MM-DD' em America/Sao_Paulo (en-CA = ISO), determinístico. */
export function hojeBrasilia(agora: Date): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// --- Geração (com banco) ---

/** @returns quantos itens de checklist foram criados (0 = já existia, modelo vazio ou cliente inexistente). */
export async function gerarProcessoParaCliente(
  clienteId: string,
  tipo: TipoProcesso,
): Promise<number> {
  try {
    // Idempotência: já existe a tarefa deste processo para o cliente?
    // Mesmo desenho check-then-insert do código anterior (a janela de corrida
    // é a mesma — na prática, webhook + baixa manual nunca duplicam).
    const etiqueta = etiquetaDoProcesso(tipo)
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(
        and(
          eq(tarefas.clienteId, clienteId),
          eq(tarefas.ehMolde, false),
          sql`${tarefas.etiquetas} @> ${JSON.stringify([etiqueta])}::jsonb`,
        ),
      )
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

    const [cliente] = await db
      .select({ nome: clientes.nome })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
    if (!cliente) return 0

    const grupo = grupoDoProcesso(tipo)
    const [tarefa] = await db
      .insert(tarefas)
      .values({
        titulo: tituloDoProcesso(tipo, cliente.nome),
        status: 'a_fazer',
        prioridade: 'alta',
        data: hojeBrasilia(new Date()),
        clienteId,
        // 1ª etiqueta = chip legível no card; 2ª = chave técnica de idempotência.
        etiquetas: [grupo, etiqueta],
      })
      .returning({ id: tarefas.id })

    const itens = itensParaChecklist(modelo)
    await db.insert(tarefaChecklistItems).values(
      itens.map((item) => ({
        tarefaId: tarefa.id,
        texto: item.texto,
        ordem: item.ordem,
        grupo,
      })),
    )
    return itens.length
  } catch (e) {
    console.error('[gerarProcessoParaCliente] falha ao criar a tarefa do processo — ignorando', e)
    return 0
  }
}
