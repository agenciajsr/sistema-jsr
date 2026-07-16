'use server'

// Server Actions das cobranças/faturas (Fase 5 Parte 1). Convenção do
// projeto: actions em src/actions/* com checagem de sessão via getCurrentUser.

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { clientes, cobrancas, contratos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { hojeBrasilia } from '@/lib/date-br'
import { competenciaDe } from '@/lib/cobrancas/regras'
import { garantirClienteAsaas, gerarCobrancaDoMes } from '@/lib/cobrancas/gerar'
import { asaasDisponivel, confirmarRecebimentoEmDinheiro } from '@/lib/asaas/client'

export type ResultadoAcaoCobranca =
  | { ok: true; invoiceUrl?: string | null; aviso?: string }
  | { ok: false; erro: string }

/** Botão "Gerar cobrança no Asaas" em /contratos (competência atual, criadoVia manual). */
export async function gerarCobrancaManual(contratoId: string): Promise<ResultadoAcaoCobranca> {
  const usuario = await getCurrentUser()
  if (!usuario) return { ok: false, erro: 'Sessão expirada. Faça login novamente.' }

  const contrato = await db.query.contratos.findFirst({ where: eq(contratos.id, contratoId) })
  if (!contrato) return { ok: false, erro: 'Contrato não encontrado.' }
  if (contrato.statusFluxo !== 'assinado') {
    return { ok: false, erro: 'Só é possível gerar cobrança de contrato assinado.' }
  }

  try {
    if (asaasDisponivel()) {
      await garantirClienteAsaas(contrato.clienteId)
    }
    const resultado = await gerarCobrancaDoMes(contrato, competenciaDe(hojeBrasilia()), {
      criadoVia: 'manual',
    })

    revalidatePath('/contratos')
    revalidatePath(`/clientes/${contrato.clienteId}`)

    if (!resultado.criada) {
      return { ok: false, erro: 'A cobrança deste mês já existe para este contrato.' }
    }
    if (resultado.avisoAsaas) {
      return {
        ok: true,
        invoiceUrl: null,
        aviso: `Fatura registrada internamente, mas o Asaas falhou: ${resultado.avisoAsaas}`,
      }
    }
    if (!asaasDisponivel()) {
      return {
        ok: true,
        invoiceUrl: null,
        aviso: 'Asaas não configurado — a fatura foi registrada apenas internamente.',
      }
    }
    return { ok: true, invoiceUrl: resultado.invoiceUrl ?? null }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Erro ao gerar a cobrança.' }
  }
}

/**
 * Botão "Confirmar recebimento (PIX manual)": quita a fatura LOCALMENTE (D-04
 * — nossa tabela é a verdade) e, se ela existir no Asaas, tenta conciliar via
 * receivedInCash (falha vira aviso, nunca desfaz a quitação local). Primeira
 * fatura paga ativa o cliente.
 */
export async function confirmarRecebimentoManual(cobrancaId: string): Promise<ResultadoAcaoCobranca> {
  const usuario = await getCurrentUser()
  if (!usuario) return { ok: false, erro: 'Sessão expirada. Faça login novamente.' }

  const cobranca = await db.query.cobrancas.findFirst({ where: eq(cobrancas.id, cobrancaId) })
  if (!cobranca) return { ok: false, erro: 'Fatura não encontrada.' }
  if (cobranca.status === 'paga') return { ok: false, erro: 'Esta fatura já está paga.' }
  if (cobranca.status === 'cancelada') return { ok: false, erro: 'Esta fatura foi cancelada.' }

  await db
    .update(cobrancas)
    .set({ status: 'paga', pagoEm: new Date(), formaQuitacao: 'pix_manual', updatedAt: new Date() })
    .where(eq(cobrancas.id, cobrancaId))

  // Ativa o cliente se ainda não estiver ativo (idempotente, sequencial).
  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, cobranca.clienteId),
    columns: { status: true },
  })
  if (cliente && cliente.status !== 'ativo') {
    await db.update(clientes).set({ status: 'ativo' }).where(eq(clientes.id, cobranca.clienteId))
  }

  let aviso: string | undefined
  if (cobranca.asaasPaymentId && asaasDisponivel()) {
    try {
      await confirmarRecebimentoEmDinheiro(cobranca.asaasPaymentId, {
        value: Number(cobranca.valor),
        paymentDate: hojeBrasilia(),
      })
    } catch (erro) {
      aviso = `Fatura quitada internamente, mas a conciliação no Asaas falhou: ${
        erro instanceof Error ? erro.message : 'erro desconhecido'
      }`
      console.warn('[cobrancas] receivedInCash falhou', erro)
    }
  }

  revalidatePath(`/clientes/${cobranca.clienteId}`)
  revalidatePath('/contratos')

  return { ok: true, aviso }
}
