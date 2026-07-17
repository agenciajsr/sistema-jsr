// Cliente REST da API do Asaas — módulo SERVER em lib (NÃO 'use server').
// D-05: sandbox primeiro (ASAAS_ENV !== 'production' → api-sandbox); auth via
// header `access_token`. Sem ASAAS_API_KEY o app degrada graciosamente: quem
// chama testa asaasDisponivel() antes — aqui só lançamos erro pt-BR claro.
// D-01: NUNCA /v3/subscriptions — cobrança avulsa mês a mês controlada por nós.
// TODAS as respostas validadas com Zod na borda.

import { z } from 'zod'

export class AsaasIndisponivelError extends Error {
  constructor() {
    super('ASAAS_API_KEY não configurada — Asaas indisponível.')
    this.name = 'AsaasIndisponivelError'
  }
}

/** Há chave de API configurada? (a UI usa para exibir o banner de aviso) */
export function asaasDisponivel(): boolean {
  return Boolean(process.env.ASAAS_API_KEY)
}

function baseUrl(): string {
  return process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
}

const erroAsaasSchema = z
  .object({
    errors: z.array(z.object({ description: z.string().optional() }).passthrough()).optional(),
  })
  .passthrough()

async function requisicao(path: string, init: { method: 'GET' | 'POST' | 'DELETE'; body?: unknown }): Promise<unknown> {
  const chave = process.env.ASAAS_API_KEY
  if (!chave) throw new AsaasIndisponivelError()

  const resposta = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      access_token: chave,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  })

  const json: unknown = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    const parsed = erroAsaasSchema.safeParse(json)
    const detalhe = parsed.success ? parsed.data.errors?.[0]?.description : undefined
    throw new Error(
      `Asaas respondeu ${resposta.status}${detalhe ? `: ${detalhe}` : ' (erro sem descrição)'}`,
    )
  }

  return json
}

const clienteAsaasSchema = z.object({ id: z.string() }).passthrough()

/** Cadastra um customer no Asaas (cpfCnpj é obrigatório na API). */
export async function criarCliente({
  nome,
  cpfCnpj,
  email,
  telefone,
}: {
  nome: string
  cpfCnpj: string
  email?: string | null
  telefone?: string | null
}): Promise<{ id: string }> {
  const json = await requisicao('/customers', {
    method: 'POST',
    body: {
      name: nome,
      cpfCnpj,
      ...(email ? { email } : {}),
      ...(telefone ? { mobilePhone: telefone } : {}),
    },
  })
  const dados = clienteAsaasSchema.parse(json)
  return { id: dados.id }
}

const cobrancaAsaasSchema = z
  .object({
    id: z.string(),
    invoiceUrl: z.string().nullish(),
    status: z.string().nullish(),
  })
  .passthrough()

/**
 * Cria uma cobrança AVULSA (D-01) com billingType 'BOLETO' (D-02 — a página
 * da fatura exibe boleto + PIX; cartão não é oferecido, clientes da JSR
 * pagam por PIX/boleto).
 */
export async function criarCobranca({
  customer,
  value,
  dueDate,
  description,
  externalReference,
}: {
  customer: string
  value: number
  dueDate: string // 'YYYY-MM-DD'
  description: string
  externalReference: string
}): Promise<{ id: string; invoiceUrl: string | null; status: string | null }> {
  const json = await requisicao('/payments', {
    method: 'POST',
    body: {
      customer,
      billingType: 'BOLETO',
      value,
      dueDate,
      description,
      externalReference,
    },
  })
  const dados = cobrancaAsaasSchema.parse(json)
  return { id: dados.id, invoiceUrl: dados.invoiceUrl ?? null, status: dados.status ?? null }
}

/** Cancela/remove uma cobrança no Asaas — DELETE /payments/{id}. */
export async function cancelarCobranca(paymentId: string): Promise<void> {
  // A resposta é { deleted: true, id } — o status ok já é checado em requisicao.
  await requisicao(`/payments/${paymentId}`, { method: 'DELETE' })
}

/**
 * Concilia no Asaas um pagamento recebido POR FORA (PIX manual na chave do
 * dono) — POST /payments/{id}/receivedInCash.
 */
export async function confirmarRecebimentoEmDinheiro(
  paymentId: string,
  { value, paymentDate }: { value: number; paymentDate: string },
): Promise<void> {
  const json = await requisicao(`/payments/${paymentId}/receivedInCash`, {
    method: 'POST',
    body: { value, paymentDate, notifyCustomer: false },
  })
  cobrancaAsaasSchema.parse(json)
}
