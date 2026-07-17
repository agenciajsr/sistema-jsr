'use server'

// Server Actions das cobranças/faturas (Fase 5 Parte 1). Convenção do
// projeto: actions em src/actions/* com checagem de sessão via getCurrentUser.

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/lib/db'
import { clientes, cobrancas, contratos } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { hojeBrasilia } from '@/lib/date-br'
import { competenciaDe, contratoElegivel, deveUsarAsaas } from '@/lib/cobrancas/regras'
import {
  garantirClienteAsaas,
  gerarCobrancaDoMes,
  retentarAsaasNaFatura,
} from '@/lib/cobrancas/gerar'
import { registrarReceitaDaCobranca } from '@/lib/cobrancas/receita'
import { asaasDisponivel, confirmarRecebimentoEmDinheiro } from '@/lib/asaas/client'

export type ResultadoAcaoCobranca =
  | { ok: true; invoiceUrl?: string | null; aviso?: string }
  | { ok: false; erro: string }

type ContratoAssinado = {
  id: string
  clienteId: string
  dataInicio: string
  dataVencimento: string
  valorMensal: string
  statusFluxo: string | null
}

/**
 * Miolo compartilhado por gerarCobrancaManual e gerarCobrancaDoMesPorCliente:
 * NUNCA duplica a fatura do mês — se ela já existe, reaproveita o link ou
 * retenta o Asaas na MESMA linha (backfill). Todo desfecho vira mensagem pt-BR.
 */
async function gerarOuReaproveitarCobranca(contrato: ContratoAssinado): Promise<ResultadoAcaoCobranca> {
  const competencia = competenciaDe(hojeBrasilia())

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, contrato.clienteId),
    columns: { modoCobranca: true },
  })
  if (!cliente) return { ok: false, erro: 'Cliente não encontrado.' }
  const clienteAutomatico = deveUsarAsaas(cliente)

  // ANTES de inserir: fatura do mês já existe? (criado_via manual não bate no
  // índice único parcial — sem esta checagem o botão duplicava a linha local.)
  const existentes = await db
    .select({
      id: cobrancas.id,
      status: cobrancas.status,
      invoiceUrl: cobrancas.invoiceUrl,
      asaasPaymentId: cobrancas.asaasPaymentId,
    })
    .from(cobrancas)
    .where(and(eq(cobrancas.contratoId, contrato.id), eq(cobrancas.competencia, competencia)))
  const aberta = existentes.find((c) => c.status === 'pendente' || c.status === 'vencida')
  const jaPaga = existentes.find((c) => c.status === 'paga')

  if (aberta) {
    if (aberta.invoiceUrl) {
      return {
        ok: true,
        invoiceUrl: aberta.invoiceUrl,
        aviso: 'A fatura deste mês já existia — link reaproveitado.',
      }
    }
    if (!clienteAutomatico) {
      return {
        ok: false,
        erro: 'Este cliente está em cobrança manual (PIX direto) — não geramos cobrança no Asaas. Use "Confirmar recebimento" na ficha.',
      }
    }
    // Cliente automático com fatura sem link → retentar o Asaas na MESMA linha.
    const invoiceUrl = await retentarAsaasNaFatura(aberta.id)
    return {
      ok: true,
      invoiceUrl,
      aviso: 'A fatura deste mês já existia — o link do Asaas foi gerado nela.',
    }
  }
  if (jaPaga) {
    return { ok: false, erro: 'A fatura deste mês já está paga para este contrato.' }
  }

  // Nenhuma fatura do mês: fluxo normal (respeita o modo do cliente).
  const resultado = await gerarCobrancaDoMes(contrato, competencia, { criadoVia: 'manual' })
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
  if (!clienteAutomatico) {
    return {
      ok: true,
      invoiceUrl: null,
      aviso: 'Cliente em cobrança manual (PIX direto) — fatura registrada apenas internamente, sem Asaas.',
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
}

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
    const resultado = await gerarOuReaproveitarCobranca(contrato)
    revalidatePath('/contratos')
    revalidatePath('/financeiro')
    revalidatePath(`/clientes/${contrato.clienteId}`)
    return resultado
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Erro ao gerar a cobrança.' }
  }
}

const modoCobrancaSchema = z.enum(['automatico_asaas', 'manual_pix'])

/** Troca o modo de cobrança do cliente (dialog de conversão / aba Faturas). */
export async function setModoCobranca(
  clienteId: string,
  modo: 'automatico_asaas' | 'manual_pix',
): Promise<ResultadoAcaoCobranca> {
  const usuario = await getCurrentUser()
  if (!usuario) return { ok: false, erro: 'Sessão expirada. Faça login novamente.' }

  const parsed = modoCobrancaSchema.safeParse(modo)
  if (!parsed.success) return { ok: false, erro: 'Modo de cobrança inválido.' }

  try {
    const atualizados = await db
      .update(clientes)
      .set({
        modoCobranca: parsed.data,
        // Espelho da flag antiga para não dessincronizar telas legadas.
        usaAsaas: parsed.data === 'automatico_asaas',
        updatedAt: new Date(),
      })
      .where(eq(clientes.id, clienteId))
      .returning({ id: clientes.id })
    if (atualizados.length === 0) return { ok: false, erro: 'Cliente não encontrado.' }

    revalidatePath(`/clientes/${clienteId}`)
    revalidatePath('/financeiro')
    return {
      ok: true,
      aviso:
        parsed.data === 'automatico_asaas'
          ? 'Modo alterado para Automático via Asaas.'
          : 'Modo alterado para Manual via PIX — este cliente não gera cobrança no Asaas.',
    }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Erro ao alterar o modo de cobrança.' }
  }
}

/** Cadastra o cliente como customer no Asaas (aba Cobranças em /financeiro). */
export async function cadastrarClienteNoAsaas(clienteId: string): Promise<ResultadoAcaoCobranca> {
  const usuario = await getCurrentUser()
  if (!usuario) return { ok: false, erro: 'Sessão expirada. Faça login novamente.' }
  if (!asaasDisponivel()) {
    return { ok: false, erro: 'Asaas não configurado — defina as variáveis de ambiente do Asaas.' }
  }

  try {
    await garantirClienteAsaas(clienteId)
    revalidatePath('/financeiro')
    revalidatePath(`/clientes/${clienteId}`)
    return { ok: true, aviso: 'Cliente cadastrado no Asaas.' }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Erro ao cadastrar o cliente no Asaas.' }
  }
}

/** Aba Cobranças em /financeiro: gera (ou reaproveita) a fatura do mês do contrato vigente do cliente. */
export async function gerarCobrancaDoMesPorCliente(clienteId: string): Promise<ResultadoAcaoCobranca> {
  const usuario = await getCurrentUser()
  if (!usuario) return { ok: false, erro: 'Sessão expirada. Faça login novamente.' }

  try {
    const hoje = hojeBrasilia()
    const assinados = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        dataInicio: contratos.dataInicio,
        dataVencimento: contratos.dataVencimento,
        valorMensal: contratos.valorMensal,
        statusFluxo: contratos.statusFluxo,
      })
      .from(contratos)
      .where(and(eq(contratos.clienteId, clienteId), eq(contratos.statusFluxo, 'assinado')))
    const vigente = assinados.find((c) => contratoElegivel(c, hoje))
    if (!vigente) {
      return {
        ok: false,
        erro: 'Este cliente não tem contrato assinado vigente — assine um contrato antes de gerar a cobrança.',
      }
    }

    const resultado = await gerarOuReaproveitarCobranca(vigente)
    revalidatePath('/financeiro')
    revalidatePath('/contratos')
    revalidatePath(`/clientes/${clienteId}`)
    return resultado
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

  // Fatura quitada vira receita no financeiro (idempotente pelo marcador).
  try {
    await registrarReceitaDaCobranca(
      {
        id: cobranca.id,
        clienteId: cobranca.clienteId,
        valor: cobranca.valor,
        competencia: cobranca.competencia,
      },
      { forma: 'pix_manual', dataPagamento: hojeBrasilia() },
    )
  } catch (erro) {
    console.warn('[cobrancas] fatura quitada, mas falhou ao registrar a receita no financeiro:', erro)
  }

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
  revalidatePath('/financeiro')

  return { ok: true, aviso }
}
