// Leitura das faturas (tabela cobrancas) — fonte da aba "Faturas" da ficha do
// cliente. Módulo server comum (NÃO 'use server'). Nome getFaturasDoCliente
// para não colidir com getCobrancasDoCliente de @/actions/financeiro (que lê
// TRANSACOES — livro-caixa, outra semântica).

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { cobrancas } from '@/lib/db/schema'

export type FaturaCliente = {
  id: string
  competencia: string
  valor: string
  status: string
  vencimento: string
  invoiceUrl: string | null
  formaQuitacao: string | null
  pagoEm: Date | null
  criadoVia: string
}

export async function getFaturasDoCliente(clienteId: string): Promise<FaturaCliente[]> {
  const linhas = await db
    .select({
      id: cobrancas.id,
      competencia: cobrancas.competencia,
      valor: cobrancas.valor,
      status: cobrancas.status,
      vencimento: cobrancas.vencimento,
      invoiceUrl: cobrancas.invoiceUrl,
      formaQuitacao: cobrancas.formaQuitacao,
      pagoEm: cobrancas.pagoEm,
      criadoVia: cobrancas.criadoVia,
    })
    .from(cobrancas)
    .where(eq(cobrancas.clienteId, clienteId))
    .orderBy(desc(cobrancas.vencimento))

  return linhas
}
