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
import { somaServicos } from '@/lib/contratos/servicos-contratados'
import { gerarPdfContrato, contarPaginasPdf, POSICAO_ASSINATURA } from '@/lib/contratos/pdf'
import { confirmarAssinatura } from '@/lib/contratos/assinatura'
import {
  criarDocumento,
  consultarDocumento,
  AutentiqueTokenAusenteError,
} from '@/lib/autentique/client'
import { requireAdmin, getCurrentUser } from '@/lib/auth/session'

const ERRO_TOKEN_AUTENTIQUE = 'Configure o token da Autentique (AUTENTIQUE_API_KEY na Vercel).'

// Conta do dono na Autentique — segundo signatário de TODO contrato. O
// documento só vira "assinado" (e o cliente só ativa) quando AMBOS assinarem
// (consultarDocumento exige todas as entradas action SIGN assinadas).
const DONO_EMAIL = 'jacsonribeiiro@gmail.com'
const DONO_NOME = 'Jacson Silva Ribeiro'

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

    // quick-260716-ky2: com serviços estruturados, o valor mensal é a SOMA
    // (recalculada aqui — nunca confiar no total vindo do cliente) e o campo
    // legado `servico` é sincronizado com o primeiro serviço marcado. Sem
    // serviços no payload, o comportamento antigo permanece (contrato legado).
    const comServicos = parsed.data.servicos && parsed.data.servicos.length > 0
    await db
      .update(contratos)
      .set({
        dataInicio: parsed.data.dataInicio,
        dataVencimento: parsed.data.dataVencimento,
        valorMensal: comServicos
          ? String(somaServicos(parsed.data.servicos!))
          : String(parsed.data.valorMensal),
        servico: comServicos ? parsed.data.servicos![0].servico : (parsed.data.servico ?? null),
        duracaoMeses: parsed.data.duracaoMeses ?? null,
        tipoDocumento: parsed.data.tipoDocumento ?? null,
        ...(parsed.data.servicos !== undefined ? { servicos: parsed.data.servicos } : {}),
      })
      .where(eq(contratos.id, id))

    revalidatePath(`/clientes/${existente.clienteId}`)
    revalidatePath('/contratos')
    return { data: { id } }
  } catch (e) {
    console.error('[atualizarDadosContrato]', e)
    return {
      error:
        'Não foi possível salvar. As migrations 0029/0030/0031 podem estar pendentes em produção.',
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
    const camposEnvio = {
      id: contratos.id,
      clienteId: contratos.clienteId,
      clienteNome: clientes.nome,
      dataInicio: contratos.dataInicio,
      dataVencimento: contratos.dataVencimento,
      valorMensal: contratos.valorMensal,
      duracaoMeses: contratos.duracaoMeses,
      dadosContratante: contratos.dadosContratante,
    }
    let registro:
      | {
          id: string
          clienteId: string
          clienteNome: string
          dataInicio: string
          dataVencimento: string
          valorMensal: string
          duracaoMeses: number | null
          dadosContratante: unknown
          servicos: unknown
        }
      | undefined
    try {
      const [r] = await db
        .select({ ...camposEnvio, servicos: contratos.servicos })
        .from(contratos)
        .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
        .where(eq(contratos.id, contratoId))
      registro = r
    } catch (e0031) {
      // Migration 0031 pendente: envia como legado (servicos null).
      console.warn('[enviarParaAssinatura] coluna servicos ausente (migration 0031 pendente?)', e0031)
      const [r] = await db
        .select(camposEnvio)
        .from(contratos)
        .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
        .where(eq(contratos.id, contratoId))
      registro = r ? { ...r, servicos: null } : undefined
    }

    if (!registro) return { error: 'Contrato não encontrado.' }
    if (!registro.dadosContratante) {
      return { error: 'O contratante ainda não preencheu os dados.' }
    }

    const vars = montarVariaveisContrato({
      contrato: {
        dataInicio: registro.dataInicio,
        dataVencimento: registro.dataVencimento,
        valorMensal: registro.valorMensal,
        duracaoMeses: registro.duracaoMeses,
        servicos: registro.servicos,
      },
      dadosContratante: registro.dadosContratante,
    })
    if ('error' in vars) return { error: vars.error }

    const pdf = await gerarPdfContrato(vars.data)
    // A página de assinaturas é sempre a ÚLTIMA do PDF gerado.
    const ultimaPagina = contarPaginasPdf(pdf)
    const documento = await criarDocumento({
      nome: `Contrato JSR — ${registro.clienteNome}`,
      pdf,
      signatarios: [
        {
          email: vars.data.emailSignatario,
          nome: vars.data.nomeSignatario,
          positions: [{ ...POSICAO_ASSINATURA.contratante, z: ultimaPagina, element: 'SIGNATURE' }],
        },
        {
          email: DONO_EMAIL,
          nome: DONO_NOME,
          positions: [{ ...POSICAO_ASSINATURA.contratado, z: ultimaPagina, element: 'SIGNATURE' }],
        },
      ],
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
    revalidatePath(`/clientes/${registro.clienteId}`)
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
  // quick-260716-ky2 — serviços estruturados (jsonb); null = legado OU
  // migration 0031 pendente. Validar com servicosContratadosSchema no consumo.
  servicos: unknown
  // Fase 4 Parte 2 — null em contratos legados OU enquanto a migration 0030
  // não for aplicada. Timestamps como ISO string (props de client component).
  tipoDocumento: string | null
  autentiqueDocumentoId: string | null
  dadosContratante: unknown
  dadosRecebidosEm: string | null
  enviadoParaAssinaturaEm: string | null
  assinadoEm: string | null
}

// Lista TODOS os contratos (de todos os clientes) para a tela /contratos.
// Marca como `vigente` o contrato atual de cada cliente (maior dataInicio),
// mesma regra usada na ficha do cliente — evita contar duplicatas no MRR.
export async function listarTodosContratos(): Promise<ContratoConsolidado[]> {
  // Degradação em CADEIA: consulta completa (0029+0030) → sem 0030 (só 0029)
  // → antiga (nenhuma). Campos ausentes viram null (padrão getWorkspaceAtual).
  // Queries SEQUENCIAIS.
  const camposBase = {
    id: contratos.id,
    clienteId: contratos.clienteId,
    clienteNome: clientes.nome,
    dataInicio: contratos.dataInicio,
    dataVencimento: contratos.dataVencimento,
    valorMensal: contratos.valorMensal,
  }
  const camposFluxo = {
    token: contratos.token,
    statusFluxo: contratos.statusFluxo,
    duracaoMeses: contratos.duracaoMeses,
    servico: contratos.servico,
    dadosContratante: contratos.dadosContratante,
    dadosRecebidosEm: contratos.dadosRecebidosEm,
  }
  const nulosFluxo = {
    token: null,
    statusFluxo: null,
    duracaoMeses: null,
    servico: null,
    dadosContratante: null,
    dadosRecebidosEm: null as Date | null,
  }
  const nulosServicos = { servicos: null as unknown }
  const nulosAssinatura = {
    tipoDocumento: null as string | null,
    autentiqueDocumentoId: null as string | null,
    enviadoParaAssinaturaEm: null as Date | null,
    assinadoEm: null as Date | null,
  }

  let rows: Array<
    Omit<
      ContratoConsolidado,
      'vigente' | 'dadosRecebidosEm' | 'enviadoParaAssinaturaEm' | 'assinadoEm'
    > & {
      dadosRecebidosEm: Date | null
      enviadoParaAssinaturaEm: Date | null
      assinadoEm: Date | null
    }
  >
  const camposAssinatura = {
    tipoDocumento: contratos.tipoDocumento,
    autentiqueDocumentoId: contratos.autentiqueDocumentoId,
    enviadoParaAssinaturaEm: contratos.enviadoParaAssinaturaEm,
    assinadoEm: contratos.assinadoEm,
  }

  try {
    rows = await db
      .select({ ...camposBase, ...camposFluxo, ...camposAssinatura, servicos: contratos.servicos })
      .from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .orderBy(clientes.nome, desc(contratos.dataInicio))
  } catch (e0031) {
    console.warn('[listarTodosContratos] coluna servicos ausente (migration 0031 pendente?)', e0031)
    try {
      const sem0031 = await db
        .select({ ...camposBase, ...camposFluxo, ...camposAssinatura })
        .from(contratos)
        .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
        .orderBy(clientes.nome, desc(contratos.dataInicio))
      rows = sem0031.map((r) => ({ ...r, ...nulosServicos }))
    } catch (e0030) {
      console.warn('[listarTodosContratos] colunas de assinatura ausentes (migration 0030 pendente?)', e0030)
      try {
        const sem0030 = await db
          .select({ ...camposBase, ...camposFluxo })
          .from(contratos)
          .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
          .orderBy(clientes.nome, desc(contratos.dataInicio))
        rows = sem0030.map((r) => ({ ...r, ...nulosServicos, ...nulosAssinatura }))
      } catch (e0029) {
        console.warn('[listarTodosContratos] colunas do fluxo ausentes (migration 0029 pendente?)', e0029)
        const antigas = await db
          .select(camposBase)
          .from(contratos)
          .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
          .orderBy(clientes.nome, desc(contratos.dataInicio))
        rows = antigas.map((r) => ({ ...r, ...nulosServicos, ...nulosFluxo, ...nulosAssinatura }))
      }
    }
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

  return rows.map((r) => ({
    ...r,
    vigente: vigenteIds.has(r.id),
    dadosRecebidosEm: r.dadosRecebidosEm?.toISOString() ?? null,
    enviadoParaAssinaturaEm: r.enviadoParaAssinaturaEm?.toISOString() ?? null,
    assinadoEm: r.assinadoEm?.toISOString() ?? null,
  }))
}
