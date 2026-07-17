// Geração de cobranças (Fase 5 Parte 1) — módulo SERVER comum em lib (NÃO
// 'use server': exports de arquivo 'use server' viram endpoints). D-04: a
// tabela cobrancas é a FONTE DA VERDADE; o Asaas é um meio de quitação —
// falha do Asaas nunca desfaz a linha local nem bloqueia fluxo nenhum.
// Queries SEQUENCIAIS (pool max=3, memória do projeto — nunca Promise.all).

import { and, eq, inArray, isNull, lt, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, cobrancas, contratos } from '@/lib/db/schema'
import { asaasDisponivel, criarCliente, criarCobranca } from '@/lib/asaas/client'
import { hojeBrasilia } from '@/lib/date-br'
import {
  competenciasPendentes,
  contratoElegivel,
  dataVencimento,
  deveUsarAsaas,
} from '@/lib/cobrancas/regras'

/** Só dígitos — o Asaas espera cpfCnpj sem máscara. */
function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** Extrai CPF/CNPJ do jsonb dadosContratante (fallback quando o cadastro do cliente não tem documento). */
function documentoDoContratante(dados: unknown): string | null {
  if (!dados || typeof dados !== 'object') return null
  const d = dados as Record<string, unknown>
  const candidato = d.cnpj ?? d.cpf
  return typeof candidato === 'string' && candidato.trim() ? candidato : null
}

/**
 * Garante que o cliente existe como customer no Asaas e retorna o id lá.
 * Idempotente: se clientes.asaasCustomerId já existe, só devolve.
 * Lança erro pt-BR claro se faltar CPF/CNPJ (exigência do Asaas).
 */
export async function garantirClienteAsaas(clienteId: string): Promise<string> {
  const cliente = await db.query.clientes.findFirst({ where: eq(clientes.id, clienteId) })
  if (!cliente) throw new Error('Cliente não encontrado.')
  if (cliente.asaasCustomerId) return cliente.asaasCustomerId

  let documento = cliente.documento
  if (!documento) {
    // Fallback: CPF/CNPJ preenchido pelo contratante no fluxo do contrato.
    const contratosDoCliente = await db
      .select({ dadosContratante: contratos.dadosContratante })
      .from(contratos)
      .where(eq(contratos.clienteId, clienteId))
    for (const c of contratosDoCliente) {
      const doc = documentoDoContratante(c.dadosContratante)
      if (doc) {
        documento = doc
        break
      }
    }
  }
  if (!documento) {
    throw new Error(
      'Cliente sem CPF/CNPJ cadastrado — o Asaas exige o documento. Preencha em Clientes → Editar.',
    )
  }

  const { id } = await criarCliente({
    nome: cliente.nome,
    cpfCnpj: somenteDigitos(documento),
    email: cliente.contatoEmail,
    telefone: cliente.contatoTelefone ? somenteDigitos(cliente.contatoTelefone) : null,
  })

  await db.update(clientes).set({ asaasCustomerId: id }).where(eq(clientes.id, clienteId))
  return id
}

type ContratoParaCobranca = {
  id: string
  clienteId: string
  dataInicio: string
  valorMensal: string
}

export type ResultadoCobranca = {
  criada: boolean
  cobrancaId?: string
  invoiceUrl?: string | null
  avisoAsaas?: string
}

/**
 * Insere a cobrança local da competência (fonte da verdade) e, se o Asaas
 * estiver disponível, cria o payment lá e grava asaasPaymentId + invoiceUrl.
 * onConflictDoNothing no índice único parcial (só automáticas) segue como
 * SEGUNDA trava do fluxo automático — a trava primária é a consulta de
 * competências não canceladas feita por quem chama (gerarPrimeiraCobranca /
 * gerarCobrancasMensais). Falha do Asaas NÃO desfaz a linha local (D-04): fica pendente
 * sem link — o botão manual em /contratos cobre.
 */
export async function gerarCobrancaDoMes(
  contrato: ContratoParaCobranca,
  competencia: string,
  { criadoVia }: { criadoVia: 'automatico' | 'manual' },
): Promise<ResultadoCobranca> {
  const hoje = hojeBrasilia()

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, contrato.clienteId),
    columns: { diaPagamento: true, nome: true, modoCobranca: true },
  })
  if (!cliente) throw new Error('Cliente não encontrado.')

  const vencimento = dataVencimento(competencia, cliente.diaPagamento, contrato.dataInicio, hoje)

  const inseridas = await db
    .insert(cobrancas)
    .values({
      clienteId: contrato.clienteId,
      contratoId: contrato.id,
      competencia,
      valor: contrato.valorMensal,
      status: 'pendente',
      vencimento,
      criadoVia,
    })
    .onConflictDoNothing()
    .returning({ id: cobrancas.id })

  const linha = inseridas[0]
  if (!linha) {
    // Conflito no índice único (competência automática já gerada) — idempotente.
    return { criada: false }
  }

  // Cliente em modo manual_pix NUNCA toca o Asaas: a fatura local nasce
  // pendente sem invoiceUrl e é quitada pelo botão "Confirmar recebimento".
  if (!asaasDisponivel() || !deveUsarAsaas(cliente)) {
    return { criada: true, cobrancaId: linha.id, invoiceUrl: null }
  }

  try {
    const customerId = await garantirClienteAsaas(contrato.clienteId)
    const pagamento = await criarCobranca({
      customer: customerId,
      value: Number(contrato.valorMensal),
      dueDate: vencimento,
      description: `Mensalidade ${competencia} — ${cliente.nome}`,
      externalReference: linha.id,
    })
    await db
      .update(cobrancas)
      .set({ asaasPaymentId: pagamento.id, invoiceUrl: pagamento.invoiceUrl, updatedAt: new Date() })
      .where(eq(cobrancas.id, linha.id))
    return { criada: true, cobrancaId: linha.id, invoiceUrl: pagamento.invoiceUrl }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.warn(
      `[cobrancas] fatura local ${linha.id} criada, mas o Asaas falhou (${mensagem}) — gere o link pelo botão manual em /contratos.`,
    )
    return { criada: true, cobrancaId: linha.id, invoiceUrl: null, avisoAsaas: mensagem }
  }
}

/**
 * Backfill do Asaas em uma fatura JÁ existente (pendente/vencida, sem
 * asaasPaymentId) de cliente automático: cria o payment lá e grava
 * asaasPaymentId/invoiceUrl na MESMA linha — nunca duplica a fatura local.
 * Lança erro pt-BR legível em qualquer impedimento.
 */
export async function retentarAsaasNaFatura(cobrancaId: string): Promise<string | null> {
  const cobranca = await db.query.cobrancas.findFirst({ where: eq(cobrancas.id, cobrancaId) })
  if (!cobranca) throw new Error('Fatura não encontrada.')
  if (cobranca.asaasPaymentId) return cobranca.invoiceUrl
  if (cobranca.status !== 'pendente' && cobranca.status !== 'vencida') {
    throw new Error('Só é possível gerar link do Asaas para fatura pendente ou vencida.')
  }
  if (!asaasDisponivel()) {
    throw new Error('Asaas não configurado — defina as variáveis de ambiente do Asaas.')
  }

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, cobranca.clienteId),
    columns: { nome: true, modoCobranca: true },
  })
  if (!cliente) throw new Error('Cliente não encontrado.')
  if (!deveUsarAsaas(cliente)) {
    throw new Error(
      'Este cliente está em cobrança manual (PIX direto) — não geramos cobrança no Asaas. Use "Confirmar recebimento" na ficha.',
    )
  }

  const customerId = await garantirClienteAsaas(cobranca.clienteId)
  const pagamento = await criarCobranca({
    customer: customerId,
    value: Number(cobranca.valor),
    dueDate: cobranca.vencimento,
    description: `Mensalidade ${cobranca.competencia} — ${cliente.nome}`,
    externalReference: cobranca.id,
  })
  await db
    .update(cobrancas)
    .set({ asaasPaymentId: pagamento.id, invoiceUrl: pagamento.invoiceUrl, updatedAt: new Date() })
    .where(eq(cobrancas.id, cobranca.id))
  return pagamento.invoiceUrl
}

/**
 * 1ª cobrança no gatilho de assinatura: gera as competências pendentes do
 * contrato (normalmente só o mês atual). Contrato começando no futuro não
 * gera nada — o cron cuida quando a vigência chegar.
 */
export async function gerarPrimeiraCobranca(contratoId: string): Promise<void> {
  const contrato = await db.query.contratos.findFirst({ where: eq(contratos.id, contratoId) })
  if (!contrato) return

  const hoje = hojeBrasilia()
  // Competência coberta por QUALQUER cobrança do contrato (manual ou
  // automática); cancelada não cobre — o mês volta a ser gerado.
  const jaGeradas = await db
    .select({ competencia: cobrancas.competencia })
    .from(cobrancas)
    .where(and(eq(cobrancas.contratoId, contratoId), ne(cobrancas.status, 'cancelada')))

  const pendentes = competenciasPendentes(
    {
      dataInicio: contrato.dataInicio,
      dataVencimento: contrato.dataVencimento,
      assinadoEm: contrato.assinadoEm
        ? contrato.assinadoEm.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
        : hoje,
    },
    jaGeradas.map((c) => c.competencia),
    hoje,
  )

  for (const competencia of pendentes) {
    await gerarCobrancaDoMes(contrato, competencia, { criadoVia: 'automatico' })
  }
}

export type ResumoCobrancasMensais = {
  cobrancasGeradas: number
  marcadasVencidas: number
}

/**
 * Carona no cron sync-meta: varre os contratos assinados vigentes e gera as
 * competências pendentes (recupera meses perdidos). Também marca como
 * 'vencida' as pendentes com vencimento passado SEM asaasPaymentId — as que
 * têm Asaas quem marca é o webhook (PAYMENT_OVERDUE).
 */
export async function gerarCobrancasMensais(): Promise<ResumoCobrancasMensais> {
  const hoje = hojeBrasilia()

  const assinados = await db
    .select({
      id: contratos.id,
      clienteId: contratos.clienteId,
      dataInicio: contratos.dataInicio,
      dataVencimento: contratos.dataVencimento,
      valorMensal: contratos.valorMensal,
      statusFluxo: contratos.statusFluxo,
      assinadoEm: contratos.assinadoEm,
    })
    .from(contratos)
    .where(eq(contratos.statusFluxo, 'assinado'))

  const vigentes = assinados.filter((c) => contratoElegivel(c, hoje))

  let cobrancasGeradas = 0
  if (vigentes.length > 0) {
    // Competência coberta por QUALQUER cobrança do contrato (manual ou
    // automática); cancelada não cobre — o mês volta a ser gerado.
    const jaGeradas = await db
      .select({ contratoId: cobrancas.contratoId, competencia: cobrancas.competencia })
      .from(cobrancas)
      .where(
        and(
          inArray(cobrancas.contratoId, vigentes.map((c) => c.id)),
          ne(cobrancas.status, 'cancelada'),
        ),
      )

    for (const contrato of vigentes) {
      const geradasDoContrato = jaGeradas
        .filter((g) => g.contratoId === contrato.id)
        .map((g) => g.competencia)
      const pendentes = competenciasPendentes(
        {
          dataInicio: contrato.dataInicio,
          dataVencimento: contrato.dataVencimento,
          assinadoEm: contrato.assinadoEm
            ? contrato.assinadoEm.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
            : null,
        },
        geradasDoContrato,
        hoje,
      )
      for (const competencia of pendentes) {
        const resultado = await gerarCobrancaDoMes(contrato, competencia, {
          criadoVia: 'automatico',
        })
        if (resultado.criada) cobrancasGeradas += 1
      }
    }
  }

  const vencidas = await db
    .update(cobrancas)
    .set({ status: 'vencida', updatedAt: new Date() })
    .where(
      and(
        eq(cobrancas.status, 'pendente'),
        lt(cobrancas.vencimento, hoje),
        isNull(cobrancas.asaasPaymentId),
      ),
    )
    .returning({ id: cobrancas.id })

  return { cobrancasGeradas, marcadasVencidas: vencidas.length }
}
