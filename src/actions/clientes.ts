'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { clientes, contratos, profiles } from '@/lib/db/schema'
import { clienteSchema, type ClienteInput } from '@/lib/validations/cliente'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'
import { construirRegistroRenovacao } from '@/lib/contratos/renovacao'
import { getCurrentUser, requireAdmin } from '@/lib/auth/session'
import { gerarProcessoParaCliente } from '@/lib/processos/gerar'
import { hojeBrasilia } from '@/lib/date-br'
import { uploadFile } from '@/lib/storage/client'

// Limite da LOGO do cliente (avatar) — igual à foto do lead: 2 MB.
const MAX_LOGO_BYTES = 2 * 1024 * 1024

const ERRO_VALIDACAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

/** Converte ClienteInput para o formato esperado pelo Drizzle (numeric como string, undefined como null). */
function clienteParaDb(data: ClienteInput) {
  // tagsTexto é campo de FORM (texto separado por vírgula) — vira o jsonb tags.
  const { tagsTexto, ...resto } = data
  return {
    ...resto,
    tags: (tagsTexto ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    diaPagamento: data.diaPagamento ?? null,
    gestorId: data.gestorId ?? null,
    verbaMensal: data.verbaMensal != null ? String(data.verbaMensal) : null,
    ticketMedio: data.ticketMedio != null ? String(data.ticketMedio) : null,
    servicosContratados: data.servicosContratados ?? [],
    segmento: data.segmento?.trim() || null,
    principalServico: data.principalServico?.trim() || null,
    pastas: data.pastas ?? [],
    // Só clientes ENCERRADOS carregam motivo de encerramento (reativar limpa).
    motivoEncerramento:
      data.status === 'encerrado' ? (data.motivoEncerramento?.trim() ?? null) : null,
  }
}

// Migration 0038 pendente (coluna data_encerramento ausente) não pode travar o
// cadastro de clientes: tenta gravar com a coluna e, se o banco reclamar
// especificamente dela (42703 undefined_column), regrava sem — o churn fica
// null até a migration ser aplicada, mas o cliente é salvo.
function erroColunaDataEncerramento(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('data_encerramento')
}

export async function createClienteComContrato(
  clienteInput: ClienteInput,
  contratoInput: ContratoInput
) {
  const clienteParsed = clienteSchema.safeParse(clienteInput)
  const contratoParsed = contratoSchema.safeParse(contratoInput)

  if (!clienteParsed.success || !contratoParsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  const criar = async (incluirDataEncerramento: boolean) =>
    db.transaction(async (tx) => {
      // Cliente já nascendo encerrado (raro) carrega a data do encerramento.
      const registroCliente = incluirDataEncerramento
        ? {
            ...clienteParaDb(clienteParsed.data),
            dataEncerramento: clienteParsed.data.status === 'encerrado' ? hojeBrasilia() : null,
          }
        : clienteParaDb(clienteParsed.data)

      const [novoCliente] = await tx
        .insert(clientes)
        .values(registroCliente)
        .returning({ id: clientes.id })

      const registro = construirRegistroRenovacao(novoCliente.id, {
        dataInicio: contratoParsed.data.dataInicio,
        dataVencimento: contratoParsed.data.dataVencimento,
        valorMensal: contratoParsed.data.valorMensal,
      })

      await tx.insert(contratos).values(registro)

      return novoCliente.id
    })

  let clienteId: string
  try {
    clienteId = await criar(true)
  } catch (e) {
    if (!erroColunaDataEncerramento(e)) throw e
    // Migration 0038 pendente — salva sem a data de encerramento.
    clienteId = await criar(false)
  }

  return { data: { clienteId } }
}

export async function updateCliente(id: string, input: ClienteInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const parsed = clienteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: ERRO_VALIDACAO }
  }

  // data_encerramento entra na MESMA normalização do motivoEncerramento:
  // encerrar preenche com hoje (Brasília), reativar limpa. Se o cliente JÁ
  // estava encerrado, a data original é preservada (não sobrescrever em
  // edições posteriores) — por isso a leitura do registro atual antes.
  let dataEncerramentoAtual: string | null = null
  try {
    const [atual] = await db
      .select({ dataEncerramento: clientes.dataEncerramento })
      .from(clientes)
      .where(eq(clientes.id, id))
    dataEncerramentoAtual = atual?.dataEncerramento ?? null
  } catch (e) {
    if (!erroColunaDataEncerramento(e)) throw e
    // Migration 0038 pendente — segue sem a coluna.
  }

  const salvar = (incluirDataEncerramento: boolean) =>
    db
      .update(clientes)
      .set({
        ...clienteParaDb(parsed.data),
        ...(incluirDataEncerramento
          ? {
              dataEncerramento:
                parsed.data.status === 'encerrado'
                  ? (dataEncerramentoAtual ?? hojeBrasilia())
                  : null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(clientes.id, id))

  try {
    await salvar(true)
  } catch (e) {
    if (!erroColunaDataEncerramento(e)) throw e
    await salvar(false)
  }

  // Cliente encerrado ganha o checklist de SAÍDA (offboarding) — idempotente,
  // best-effort (o helper engole falhas).
  if (parsed.data.status === 'encerrado') {
    await gerarProcessoParaCliente(id, 'saida')
  }

  return { data: { id } }
}

type MetaInput = { metaCpa: string | null; metaCpl: string | null; metaRoas: string | null }

// Normaliza um campo de meta: vazio → null; caso contrário exige número >= 0.
// Retorna { valor } (string numérica ou null) ou { erro } se inválido.
function normalizarMeta(raw: string | null): { valor: string | null } | { erro: true } {
  if (raw == null) return { valor: null }
  const trimmed = raw.trim()
  if (trimmed === '') return { valor: null }
  const num = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(num) || num < 0) return { erro: true }
  return { valor: String(num) }
}

export async function updateMetasCliente(clienteId: string, input: MetaInput) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const cpa = normalizarMeta(input.metaCpa)
  const cpl = normalizarMeta(input.metaCpl)
  const roas = normalizarMeta(input.metaRoas)

  if ('erro' in cpa || 'erro' in cpl || 'erro' in roas) {
    return { error: 'As metas devem ser números maiores ou iguais a zero.' }
  }

  await db
    .update(clientes)
    .set({
      metaCpa: cpa.valor,
      metaCpl: cpl.valor,
      metaRoas: roas.valor,
      updatedAt: new Date(),
    })
    .where(eq(clientes.id, clienteId))

  revalidatePath('/clientes/' + clienteId)
  revalidatePath('/campanhas')

  return { data: { id: clienteId } }
}

export async function deleteCliente(id: string) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) {
    return { error: 'Apenas administradores podem excluir clientes.' }
  }

  await db.delete(clientes).where(eq(clientes.id, id))

  return { data: { id } }
}

export async function getProfiles() {
  const rows = await db.select({ id: profiles.id, nome: profiles.nome }).from(profiles)
  return rows
}

/**
 * Envia a LOGO do cliente (lápis sobre o avatar do header da ficha) para o
 * bucket PÚBLICO crm-fotos e grava a URL pública em logo_url. Path fixo por
 * cliente (clientes/{id}.{ext}) com upsert: trocar a logo sobrescreve a
 * anterior; o `?v=timestamp` na URL fura o cache do navegador na troca.
 * Mesmo padrão de atualizarFotoLead (crm-lead.ts).
 */
export async function atualizarLogoCliente(clienteId: string, formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Sessão expirada. Faça login novamente.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Nenhuma imagem selecionada.' }
  if (!file.type.startsWith('image/')) return { error: 'Envie uma imagem (JPG, PNG ou WebP).' }
  if (file.size > MAX_LOGO_BYTES) return { error: 'Imagem muito grande. Máximo: 2 MB.' }

  try {
    const ext =
      (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `clientes/${clienteId}.${ext}`
    const upload = await uploadFile(file, clienteId, {
      bucket: 'crm-fotos',
      path,
      upsert: true,
    })
    if ('error' in upload) return { error: upload.error }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return { error: 'NEXT_PUBLIC_SUPABASE_URL não configurada.' }
    const logoUrl = `${base}/storage/v1/object/public/crm-fotos/${upload.path}?v=${Date.now()}`

    const [salvo] = await db
      .update(clientes)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(clientes.id, clienteId))
      .returning({ id: clientes.id })

    if (!salvo) return { error: 'Cliente não encontrado.' }

    revalidatePath(`/clientes/${clienteId}`)
    revalidatePath('/clientes')
    return { data: { logoUrl } }
  } catch (e) {
    console.error('[atualizarLogoCliente]', e)
    return { error: 'Não foi possível enviar a logo.' }
  }
}
