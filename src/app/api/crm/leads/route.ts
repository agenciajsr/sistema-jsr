import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { crmLeadInbox } from '@/lib/db/schema'
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
  if (contentType.includes('multipart/form-data') || contentType.includes('x-www-form-urlencoded')) {
    const fd = await request.formData()
    const raw: Record<string, unknown> = {}
    for (const [k, v] of fd.entries()) {
      raw[k] = typeof v === 'string' ? v : '' // ignora arquivos
    }
    return raw
  }
  // Content-type ausente/estranho (text/plain etc.): tenta JSON no texto cru.
  const texto = await request.text()
  return JSON.parse(texto) as Record<string, unknown>
}

/**
 * Rede de segurança de depuração: grava no inbox (status 'erro') o corpo CRU e
 * o motivo, para dar para inspecionar o que uma ferramenta externa mandou
 * quando algo falha. Nunca lança (é o último recurso).
 */
async function registrarErroInbox(corpo: string, contentType: string, motivo: string) {
  try {
    const workspace = await getWorkspaceAtual()
    if (!workspace) return
    await db.insert(crmLeadInbox).values({
      workspaceId: workspace.id,
      fonte: 'erro_webhook',
      payload: { corpo: corpo.slice(0, 20000), contentType, motivo },
      status: 'erro',
      erroDetalhe: motivo.slice(0, 1000),
      dedupHash: `erro-${randomUUID()}`,
    })
  } catch (e) {
    console.error('[registrarErroInbox]', e)
  }
}

// Validação de URL: algumas ferramentas (extensões, automações) fazem um GET
// na URL antes de aceitar o webhook. Responde 200 sem expor nada.
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  // (a) token: sem CRM_LEADS_TOKEN configurado, a rota recusa tudo.
  const token = process.env.CRM_LEADS_TOKEN
  const tokenRecebido =
    request.headers.get('x-crm-token') ?? new URL(request.url).searchParams.get('token')
  if (!token || tokenRecebido !== token) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  // Corpo em TEXTO primeiro (via clone) — se qualquer etapa falhar, gravamos o
  // corpo cru no inbox (status 'erro') para inspecionar o que a ferramenta mandou.
  const contentType = request.headers.get('content-type') ?? ''
  let corpoTexto = ''
  try {
    corpoTexto = await request.clone().text()
  } catch {
    /* segue sem o texto */
  }

  try {
    // (b) corpo cru (JSON ou form-data) -> normaliza p/ o formato do lead ->
    //     valida com Zod ANTES de tocar o banco.
    let bruto: Record<string, unknown>
    try {
      bruto = await lerCorpoCru(request)
    } catch {
      await registrarErroInbox(corpoTexto, contentType, 'Corpo nao e JSON nem form-data valido.')
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
      await registrarErroInbox(corpoTexto, contentType, `Validacao: ${mensagem}`)
      return NextResponse.json({ error: mensagem }, { status: 400 })
    }

    // (c) workspace (v1 single-tenant, seed da migration 0019).
    const workspace = await getWorkspaceAtual()
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace nao configurado.' }, { status: 503 })
    }

    // (d) ingestão compartilhada com dedup idempotente por dia.
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
    console.error('[api/crm/leads]', erro)
    await registrarErroInbox(corpoTexto, contentType, `Excecao: ${erro instanceof Error ? erro.message : String(erro)}`)
    return NextResponse.json({ error: 'Erro ao processar o lead.' }, { status: 500 })
  }
}
