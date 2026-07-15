import { NextResponse } from 'next/server'

import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { processarLead } from '@/lib/crm/ingest'
import { leadEntradaSchema } from '@/lib/validations/crm'

// API pública de captação de leads (landing pages, automações externas).
// Proteção por token compartilhado no header `x-crm-token` comparado com
// CRM_LEADS_TOKEN. ⚠️ DIFERENTE do cron: SEM modo desprotegido — env ausente
// ou header divergente => 401 SEMPRE (este endpoint é exposto à internet).
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  // (a) token: sem CRM_LEADS_TOKEN configurado, a rota recusa tudo.
  const token = process.env.CRM_LEADS_TOKEN
  if (!token || request.headers.get('x-crm-token') !== token) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  // (b) body JSON validado com Zod ANTES de tocar o banco.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisicao nao e JSON valido.' }, { status: 400 })
  }

  const parsed = leadEntradaSchema.safeParse(body)
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
