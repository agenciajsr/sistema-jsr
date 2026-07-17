// Webhook do Asaas — ROTA PÚBLICA de propósito (o Asaas chama sem auth nossa).
// Segurança: header `asaas-access-token` comparado (timingSafeEqual) com
// ASAAS_WEBHOOK_TOKEN. Env ausente → warn e segue (padrão soft do webhook da
// Autentique); header divergente COM env presente → 401.
// Nossa tabela cobrancas é a fonte da verdade de exibição; o webhook só
// espelha o status do pagamento. Sempre responder 200 rápido — payment não
// encontrado NÃO vira erro (senão o Asaas re-tenta para sempre).

import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { clientes, cobrancas } from '@/lib/db/schema'
import { registrarReceitaDaCobranca, removerReceitaDaCobranca } from '@/lib/cobrancas/receita'

export const runtime = 'nodejs'
export const maxDuration = 60

const payloadSchema = z
  .object({
    event: z.string(),
    payment: z
      .object({
        id: z.string(),
        status: z.string().optional(),
        paymentDate: z.string().nullish(),
        invoiceUrl: z.string().nullish(),
      })
      .passthrough(),
  })
  .passthrough()

/** true = autorizado a prosseguir; false = rejeitar com 401. */
function conferirToken(request: Request): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN
  if (!esperado) {
    console.warn('[webhook asaas] ASAAS_WEBHOOK_TOKEN não configurado — webhook sem verificação.')
    return true
  }
  const recebido = request.headers.get('asaas-access-token') ?? ''
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  try {
    if (!conferirToken(request)) {
      return NextResponse.json({ ok: false, error: 'Token do webhook inválido.' }, { status: 401 })
    }

    const bruto: unknown = await request.json().catch(() => null)
    const parsed = payloadSchema.safeParse(bruto)
    if (!parsed.success) {
      console.warn('[webhook asaas] payload em formato inesperado — ignorado.')
      return NextResponse.json({ ok: false })
    }

    const { event, payment } = parsed.data

    const [cobranca] = await db
      .select({
        id: cobrancas.id,
        clienteId: cobrancas.clienteId,
        status: cobrancas.status,
        valor: cobrancas.valor,
        competencia: cobrancas.competencia,
      })
      .from(cobrancas)
      .where(eq(cobrancas.asaasPaymentId, payment.id))

    if (!cobranca) {
      console.warn(`[webhook asaas] pagamento ${payment.id} sem cobrança correspondente.`)
      return NextResponse.json({ ok: false })
    }

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      await db
        .update(cobrancas)
        .set({
          status: 'paga',
          pagoEm: payment.paymentDate ? new Date(`${payment.paymentDate}T12:00:00Z`) : new Date(),
          formaQuitacao: 'asaas',
          ...(payment.invoiceUrl ? { invoiceUrl: payment.invoiceUrl } : {}),
          updatedAt: new Date(),
        })
        .where(eq(cobrancas.id, cobranca.id))

      // Fatura paga vira receita no financeiro (idempotente pelo marcador em
      // notas). Falha aqui NÃO desfaz a quitação — só loga.
      try {
        await registrarReceitaDaCobranca(cobranca, {
          forma: 'asaas',
          dataPagamento: payment.paymentDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
        })
      } catch (erro) {
        console.warn('[webhook asaas] fatura paga, mas falhou ao registrar a receita no financeiro:', erro)
      }

      // Primeira fatura paga confirma a ativação do cliente (idempotente,
      // dois updates SEQUENCIAIS — pool max=3).
      const cliente = await db.query.clientes.findFirst({
        where: eq(clientes.id, cobranca.clienteId),
        columns: { status: true },
      })
      if (cliente && cliente.status !== 'ativo') {
        await db.update(clientes).set({ status: 'ativo' }).where(eq(clientes.id, cobranca.clienteId))
        console.log(`[webhook asaas] cliente ${cobranca.clienteId} ativado pela fatura paga.`)
      }
    } else if (event === 'PAYMENT_OVERDUE') {
      if (cobranca.status !== 'paga') {
        await db
          .update(cobrancas)
          .set({ status: 'vencida', updatedAt: new Date() })
          .where(eq(cobrancas.id, cobranca.id))
      }
    } else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      await db
        .update(cobrancas)
        .set({ status: 'cancelada', updatedAt: new Date() })
        .where(eq(cobrancas.id, cobranca.id))
      // Se a fatura já tinha virado receita, o estorno tira do financeiro
      // (só remove transação criada por nós — lançamento manual fica intacto).
      try {
        await removerReceitaDaCobranca(cobranca.id)
      } catch (erro) {
        console.warn('[webhook asaas] fatura cancelada, mas falhou ao remover a receita vinculada:', erro)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    // 200 mesmo com erro nosso: o cron reconcilia e o botão manual cobre.
    console.error('[webhook asaas]', e)
    return NextResponse.json({ ok: true })
  }
}
