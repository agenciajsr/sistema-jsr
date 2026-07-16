'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { contratos, clientes } from '@/lib/db/schema'
import {
  contratoSchema,
  contratoEdicaoSchema,
  type ContratoInput,
  type ContratoEdicaoInput,
} from '@/lib/validations/contrato'
import { construirRegistroRenovacao } from '@/lib/contratos/renovacao'
import { selecionarContratoAtual, type ContratoRow } from '@/lib/contratos/current'
import { montarVariaveisContrato } from '@/lib/contratos/variaveis'
import { gerarPdfContrato } from '@/lib/contratos/pdf'
import { confirmarAssinatura } from '@/lib/contratos/assinatura'
import {
  criarDocumento,
  consultarDocumento,
  AutentiqueTokenAusenteError,
} from '@/lib/autentique/client'
import { requireAdmin, getCurrentUser } from '@/lib/auth/session'

const ERRO_TOKEN_AUTENTIQUE = 'Configure o token da Autentique (AUTENTIQUE_API_TOKEN na Vercel).'

const ERRO_VALIDACAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

export async function registrarContrato(clienteId: string, input: ContratoInput) {
  const parsed = contratoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const registro = construirRegistroRenovacao(clienteId, {
    dataInicio: parsed.data.dataInicio,
    dataVencimento: parsed.data.dataVencimento,
    valorMensal: parsed.data.valorMensal,
  })

  // D-06: renovação sempre insere um novo registro — nunca db.update.
  await db.insert(contratos).values(registro)

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/contratos')
  return { data: { clienteId } }
}

// Edição de um contrato existente (admin). Diferente de registrarContrato, que
// SEMPRE insere (renovação = novo registro), esta action corrige um registro já
// existente via db.update — usada quando os dados foram digitados errados.
export async function atualizarContrato(id: string, input: ContratoInput) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem editar contratos.' }
  }

  const parsed = contratoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  // Descobre o clienteId para revalidar o detalhe do cliente correto.
  const [existente] = await db
    .select({ clienteId: contratos.clienteId })
    .from(contratos)
    .where(eq(contratos.id, id))

  if (!existente) {
    return { error: 'Contrato não encontrado.' }
  }

  await db
    .update(contratos)
    .set({
      dataInicio: parsed.data.dataInicio,
      dataVencimento: parsed.data.dataVencimento,
      valorMensal: String(parsed.data.valorMensal),
    })
    .where(eq(contratos.id, id))

  revalidatePath(`/clientes/${existente.clienteId}`)
  revalidatePath('/contratos')

  return { data: { id } }
}

// Edição COMPLETA (Fase 4 Parte 2): datas/valor + serviço, duração e tipo de
// documento. Mantém o gate de admin, como atualizarContrato.
export async function atualizarDadosContrato(id: string, input: ContratoEdicaoInput) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem editar contratos.' }
  }

  const parsed = contratoEdicaoSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? ERRO_VALIDACAO }
  }

  try {
    const [existente] = await db
      .select({ clienteId: contratos.clienteId })
      .from(contratos)
      .where(eq(contratos.id, id))

    if (!existente) {
      return { error: 'Contrato não encontrado.' }
    }

    await db
      .update(contratos)
      .set({
        dataInicio: parsed.data.dataInicio,
        dataVencimento: parsed.data.dataVencimento,
        valorMensal: String(parsed.data.valorMensal),
        servico: parsed.data.servico ?? null,
        duracaoMeses: parsed.data.duracaoMeses ?? null,
        tipoDocumento: parsed.data.tipoDocumento ?? null,
      })
      .where(eq(contratos.id, id))

    revalidatePath(`/clientes/${existente.clienteId}`)
    revalidatePath('/contratos')
    return { data: { id } }
  } catch (e) {
    console.error('[atualizarDadosContrato]', e)
    return {
      error:
        'Não foi possível salvar. As migrations 0029/0030 podem estar pendentes em produção.',
    }
  }
}

// Envia (ou REENVIA) o contrato para assinatura na Autentique. Reenvio quando
// já está aguardando_assinatura: cria um NOVO documento (o PDF é regenerado
// com os dados ATUAIS — se o contratante corrigiu os dados pelo link, o novo
// envio reflete a correção) e sobrescreve o autentiqueDocumentoId; o documento
// antigo fica órfão na Autentique, o que é inofensivo.
export async function enviarParaAssinatura(contratoId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada — faça login novamente.' }

  try {
    const [row] = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        clienteNome: clientes.nome,
        dataInicio: contratos.dataInicio,
        dataVencimento: contratos.dataVencimento,
        valorMensal: contratos.valorMensal,
        duracaoMeses: contratos.duracaoMeses,
        dadosContratante: contratos.dadosContratante,
      })
      .from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .where(eq(contratos.id, contratoId))

    if (!row) return { error: 'Contrato não encontrado.' }
    if (!row.dadosContratante) {
      return { error: 'O contratante ainda não preencheu os dados.' }
    }

    const vars = montarVariaveisContrato({
      contrato: {
        dataInicio: row.dataInicio,
        dataVencimento: row.dataVencimento,
        valorMensal: row.valorMensal,
        duracaoMeses: row.duracaoMeses,
      },
      dadosContratante: row.dadosContratante,
    })
    if ('error' in vars) return { error: vars.error }

    const pdf = await gerarPdfContrato(vars.data)
    const documento = await criarDocumento({
      nome: `Contrato JSR — ${row.clienteNome}`,
      pdf,
      signatario: { email: vars.data.emailSignatario, nome: vars.data.nomeSignatario },
    })

    await db
      .update(contratos)
      .set({
        autentiqueDocumentoId: documento.id,
        enviadoParaAssinaturaEm: new Date(),
        statusFluxo: 'aguardando_assinatura',
      })
      .where(eq(contratos.id, contratoId))

    revalidatePath('/contratos')
    revalidatePath(`/clientes/${row.clienteId}`)
    return { data: { documentoId: documento.id } }
  } catch (e) {
    if (e instanceof AutentiqueTokenAusenteError) {
      return { error: ERRO_TOKEN_AUTENTIQUE }
    }
    console.error('[enviarParaAssinatura]', e)
    return { error: 'Não foi possível enviar para assinatura. Tente novamente em instantes.' }
  }
}

// Fallback OFICIAL do webhook: consulta a Autentique e, se todos assinaram,
// marca assinado + ativa o cliente.
export async function atualizarStatusAssinatura(contratoId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessão expirada — faça login novamente.' }

  try {
    const [row] = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        statusFluxo: contratos.statusFluxo,
        autentiqueDocumentoId: contratos.autentiqueDocumentoId,
      })
      .from(contratos)
      .where(eq(contratos.id, contratoId))

    if (!row) return { error: 'Contrato não encontrado.' }
    if (!row.autentiqueDocumentoId) {
      return { error: 'Este contrato ainda não foi enviado para assinatura.' }
    }
    if (row.statusFluxo === 'assinado') {
      return { data: { assinado: true } }
    }

    const { assinado } = await consultarDocumento(row.autentiqueDocumentoId)
    if (!assinado) {
      return { data: { assinado: false } }
    }

    await confirmarAssinatura(row.id, row.clienteId)
    revalidatePath('/contratos')
    revalidatePath(`/clientes/${row.clienteId}`)
    return { data: { assinado: true } }
  } catch (e) {
    if (e instanceof AutentiqueTokenAusenteError) {
      return { error: ERRO_TOKEN_AUTENTIQUE }
    }
    console.error('[atualizarStatusAssinatura]', e)
    return { error: 'Não foi possível consultar a Autentique. Tente novamente em instantes.' }
  }
}

export async function deleteContrato(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir contratos.' }
  }

  const [existente] = await db
    .select({ clienteId: contratos.clienteId })
    .from(contratos)
    .where(eq(contratos.id, id))

  await db.delete(contratos).where(eq(contratos.id, id))

  if (existente) revalidatePath(`/clientes/${existente.clienteId}`)
  revalidatePath('/contratos')
  return { data: { id } }
}

export async function getContratosDoCliente(clienteId: string) {
  const historico = await db.query.contratos.findMany({
    where: eq(contratos.clienteId, clienteId),
    orderBy: [desc(contratos.dataInicio)],
  })

  const contratoAtual = selecionarContratoAtual(historico)

  return { contratoAtual, historico }
}

export type ContratoConsolidado = {
  id: string
  clienteId: string
  clienteNome: string
  dataInicio: string
  dataVencimento: string
  valorMensal: string
  vigente: boolean
  // Fase 4 Parte 1 — null em contratos legados OU enquanto a migration 0029
  // não for aplicada (degradação graciosa: a consulta recai na antiga).
  token: string | null
  statusFluxo: string | null
  duracaoMeses: number | null
  servico: string | null
}

// Lista TODOS os contratos (de todos os clientes) para a tela /contratos.
// Marca como `vigente` o contrato atual de cada cliente (maior dataInicio),
// mesma regra usada na ficha do cliente — evita contar duplicatas no MRR.
export async function listarTodosContratos(): Promise<ContratoConsolidado[]> {
  // Tenta a consulta COMPLETA (com as colunas do fluxo da 0029); se as colunas
  // ainda não existirem em produção, recai na consulta antiga com campos novos
  // = null (padrão getWorkspaceAtual). Queries SEQUENCIAIS.
  let rows: Array<{
    id: string
    clienteId: string
    clienteNome: string
    dataInicio: string
    dataVencimento: string
    valorMensal: string
    token: string | null
    statusFluxo: string | null
    duracaoMeses: number | null
    servico: string | null
  }>
  try {
    rows = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        clienteNome: clientes.nome,
        dataInicio: contratos.dataInicio,
        dataVencimento: contratos.dataVencimento,
        valorMensal: contratos.valorMensal,
        token: contratos.token,
        statusFluxo: contratos.statusFluxo,
        duracaoMeses: contratos.duracaoMeses,
        servico: contratos.servico,
      })
      .from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .orderBy(clientes.nome, desc(contratos.dataInicio))
  } catch (e) {
    console.warn('[listarTodosContratos] colunas do fluxo ausentes (migration 0029 pendente?)', e)
    const antigas = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        clienteNome: clientes.nome,
        dataInicio: contratos.dataInicio,
        dataVencimento: contratos.dataVencimento,
        valorMensal: contratos.valorMensal,
      })
      .from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .orderBy(clientes.nome, desc(contratos.dataInicio))
    rows = antigas.map((r) => ({
      ...r,
      token: null,
      statusFluxo: null,
      duracaoMeses: null,
      servico: null,
    }))
  }

  // Agrupa por cliente e descobre o contrato vigente (atual) de cada um.
  const porCliente = new Map<string, ContratoRow[]>()
  for (const r of rows) {
    const lista = porCliente.get(r.clienteId) ?? []
    lista.push(r)
    porCliente.set(r.clienteId, lista)
  }
  const vigenteIds = new Set<string>()
  for (const lista of porCliente.values()) {
    const atual = selecionarContratoAtual(lista)
    if (atual) vigenteIds.add(atual.id)
  }

  return rows.map((r) => ({ ...r, vigente: vigenteIds.has(r.id) }))
}
