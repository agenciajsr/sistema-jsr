import { NextResponse } from 'next/server'

import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { processarLead } from '@/lib/crm/ingest'
import {
  ehPayloadExtensaoWhats,
  eventoAceitoExtensaoWhats,
  normalizarLeadEntrada,
} from '@/lib/crm/normalizar-entrada'
import { leadEntradaSchema } from '@/lib/validations/crm'

// API pública de captação de leads (landing pages, automações externas).
// Proteção por token compartilhado comparado com CRM_LEADS_TOKEN, aceito no
// header `x-crm-token` OU na query `?token=` (o webhook do Elementor só deixa
// colar a URL, sem header). ⚠️ SEM modo desprotegido: env ausente ou token
// divergente => 401 SEMPRE (este endpoint é exposto à internet).
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Lê o corpo em qualquer formato comum de webhook: JSON OU form-data
 * (application/x-www-form-urlencoded / multipart — como o Elementor manda).
 * Devolve um mapa cru chave→valor; a normalização acontece depois.
 */
async function lerCorpoCru(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>
  }
  // form-urlencoded ou multipart (Elementor, formulários HTML nativos)
  const fd = await request.formData()
  const raw: Record<string, unknown> = {}
  for (const [k, v] of fd.entries()) {
    raw[k] = typeof v === 'string' ? v : '' // ignora arquivos
  }
  return raw
}

export async function POST(request: Request) {
  // (a) token: sem CRM_LEADS_TOKEN configurado, a rota recusa tudo.
  const token = process.env.CRM_LEADS_TOKEN
  const tokenRecebido =
    request.headers.get('x-crm-token') ?? new URL(request.url).searchParams.get('token')
  if (!token || tokenRecebido !== token) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  // (b) corpo cru (JSON ou form-data) -> normaliza p/ o formato do lead ->
  //     valida com Zod ANTES de tocar o banco. A normalização entende o
  //     formato do Elementor e preserva todas as respostas em extra.
  let bruto: Record<string, unknown>
  try {
    bruto = await lerCorpoCru(request)
  } catch {
    return NextResponse.json({ error: 'Corpo da requisicao invalido.' }, { status: 400 })
  }

  // Extensão de WhatsApp (prospecção ativa): a extensão dispara para TODOS os
  // contatos — só ingerimos quem está na etapa "Primeiro Contato Frio" (mesmo
  // filtro do antigo cenário do Make). O resto é ignorado com 200 (não é erro).
  if (ehPayloadExtensaoWhats(bruto) && !eventoAceitoExtensaoWhats(bruto)) {
    return NextResponse.json({ ignorado: true })
  }

  const parsed = leadEntradaSchema.safeParse(normalizarLeadEntrada(bruto))
  if (!parsed.success) {
    const mensagem = parsed.error.issues[0]?.message ?? 'Dados invalidos.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }

  // (c) workspace (v1 single-tenant, seed da migration 0019).
  const workspace = await getWorkspaceAtual()
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace nao configurado.' }, { status: 503 })
  }

  // (d) ingestão compartilhada com dedup idempotente por dia.
  try {
    const resultado = await processarLead(parsed.data, workspace.id)

    if ('duplicado' in resultado && resultado.duplicado) {
      return NextResponse.json({ duplicado: true })
    }

    return NextResponse.json({
      ok: true,
      contatoId: resultado.contatoId,
      oportunidadeId: resultado.oportunidadeId,
    })
  } catch (erro) {
    // Já registrado no inbox com status 'erro' pelo processarLead.
    console.error('[api/crm/leads]', erro)
    return NextResponse.json({ error: 'Erro ao processar o lead.' }, { status: 500 })
  }
}
