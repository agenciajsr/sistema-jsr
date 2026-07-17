// Ponte cobranças → financeiro (Fase 5): fatura PAGA vira transação de
// receita na tabela transacoes (é dela que /financeiro calcula receita,
// lucro e a receber). Dedup SEM migration: o marcador [cobranca:<id>] vive
// em transacoes.notas — nunca duplica a receita da mesma fatura.
// Falha aqui NUNCA desfaz a quitação da fatura: quem chama envolve em
// try/catch (a tabela cobrancas segue sendo a fonte da verdade — D-04).

import { eq, like } from 'drizzle-orm'

import { db } from '@/lib/db'
import { transacoes } from '@/lib/db/schema'

export type FormaQuitacaoReceita = 'asaas' | 'pix_manual'

type CobrancaParaReceita = {
  id: string
  clienteId: string
  valor: string
  competencia: string
}

/** Marcador de dedup gravado em transacoes.notas. PURA (testada). */
export function marcadorCobranca(cobrancaId: string): string {
  return `[cobranca:${cobrancaId}]`
}

/** Monta os valores da transação de receita da fatura. PURA (testada). */
export function montarTransacaoDaCobranca(
  cobranca: CobrancaParaReceita,
  { forma, dataPagamento }: { forma: FormaQuitacaoReceita; dataPagamento: string },
): typeof transacoes.$inferInsert {
  return {
    tipo: 'receita',
    categoria: 'mensalidade',
    clienteId: cobranca.clienteId,
    descricao: `Mensalidade ${cobranca.competencia} (fatura)`,
    valor: cobranca.valor,
    data: dataPagamento,
    status: 'pago',
    recorrencia: 'avulsa',
    // No PIX manual sabemos a forma; no Asaas o cliente pode ter pago
    // por PIX ou boleto — não chutamos.
    formaPagamento: forma === 'pix_manual' ? 'pix' : null,
    notas: `Receita gerada automaticamente pela fatura paga. ${marcadorCobranca(cobranca.id)}`,
  }
}

/**
 * Registra a receita da fatura paga (idempotente pelo marcador em notas).
 * Retorna true se inseriu, false se já existia.
 */
export async function registrarReceitaDaCobranca(
  cobranca: CobrancaParaReceita,
  opcoes: { forma: FormaQuitacaoReceita; dataPagamento: string },
): Promise<boolean> {
  const existente = await db
    .select({ id: transacoes.id })
    .from(transacoes)
    .where(like(transacoes.notas, `%${marcadorCobranca(cobranca.id)}%`))
  if (existente.length > 0) return false

  await db.insert(transacoes).values(montarTransacaoDaCobranca(cobranca, opcoes))
  return true
}

/**
 * Remove a receita vinculada à fatura (estorno/cancelamento de fatura que já
 * estava paga). Só apaga transações criadas por nós (identificadas pelo
 * marcador) — lançamento manual do usuário nunca é tocado.
 */
export async function removerReceitaDaCobranca(cobrancaId: string): Promise<void> {
  const vinculadas = await db
    .select({ id: transacoes.id })
    .from(transacoes)
    .where(like(transacoes.notas, `%${marcadorCobranca(cobrancaId)}%`))
  for (const t of vinculadas) {
    await db.delete(transacoes).where(eq(transacoes.id, t.id))
  }
}
