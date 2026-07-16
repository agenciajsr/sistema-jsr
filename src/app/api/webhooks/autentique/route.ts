// Webhook da Autentique — ROTA PÚBLICA de propósito (a Autentique chama sem
// auth nossa). Segurança: o payload NUNCA é a fonte da verdade — só extraímos
// o id do documento e CONSULTAMOS a API da Autentique (com o nosso token) para
// confirmar que todos assinaram. Sem token de validação de webhook disponível
// no plano atual, essa consulta é a validação. O botão "Atualizar status" na
// tabela /contratos é o fallback oficial caso o webhook não chegue.

import { createHmac, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contratos } from '@/lib/db/schema'
import { consultarDocumento } from '@/lib/autentique/client'
import { confirmarAssinatura } from '@/lib/contratos/assinatura'

export const maxDuration = 60

// O formato do payload da Autentique varia por versão/evento — procuramos o id
// do documento em todos os caminhos conhecidos, defensivamente.
function extrairDocumentoId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>

  const candidatos: unknown[] = [
    (p.document as Record<string, unknown> | undefined)?.id,
    (p.documento as Record<string, unknown> | undefined)?.id,
    ((p.data as Record<string, unknown> | undefined)?.document as
      | Record<string, unknown>
      | undefined)?.id,
    ((p.event as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)
      ?.document
      ? (((p.event as Record<string, unknown>).data as Record<string, unknown>)
          .document as Record<string, unknown>)?.id
      : undefined,
    p.document_id,
    p.uuid,
    p.id,
  ]

  for (const c of candidatos) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return null
}

// Conferência de procedência via Endpoint Secret (HMAC-SHA256 do corpo cru).
// SOFT por design: assinatura ausente/divergente gera warn mas NÃO rejeita —
// a fonte da verdade continua sendo a consulta à API. Header exato pode variar
// por versão da Autentique, então testamos os candidatos conhecidos.
function conferirAssinatura(request: Request, corpoCru: string): void {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET
  if (!secret) return
  const recebida =
    request.headers.get('x-autentique-signature') ??
    request.headers.get('x-signature') ??
    request.headers.get('signature')
  if (!recebida) {
    console.warn('[webhook autentique] sem header de assinatura no request')
    return
  }
  const esperada = createHmac('sha256', secret).update(corpoCru).digest('hex')
  const limpa = recebida.replace(/^sha256=/, '').trim().toLowerCase()
  const a = Buffer.from(limpa)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn('[webhook autentique] assinatura do webhook divergente do secret')
  }
}

export async function POST(request: Request) {
  try {
    const corpoCru = await request.text().catch(() => '')
    conferirAssinatura(request, corpoCru)
    let payload: unknown = null
    try {
      payload = JSON.parse(corpoCru)
    } catch {
      payload = null
    }
    const documentoId = extrairDocumentoId(payload)
    if (!documentoId) {
      console.warn('[webhook autentique] payload sem id de documento reconhecível')
      return NextResponse.json({ ok: true })
    }

    const [contrato] = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        statusFluxo: contratos.statusFluxo,
      })
      .from(contratos)
      .where(eq(contratos.autentiqueDocumentoId, documentoId))

    if (!contrato) {
      console.warn(`[webhook autentique] documento ${documentoId} sem contrato correspondente`)
      return NextResponse.json({ ok: true })
    }
    if (contrato.statusFluxo === 'assinado') {
      return NextResponse.json({ ok: true })
    }

    // Fonte da verdade: a API, não o payload.
    const { assinado } = await consultarDocumento(documentoId)
    if (assinado) {
      await confirmarAssinatura(contrato.id, contrato.clienteId)
      console.log(`[webhook autentique] contrato ${contrato.id} assinado — cliente ativado`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    // Sempre 200 rápido: erro nosso não deve fazer a Autentique reenfileirar
    // indefinidamente; o botão "Atualizar status" cobre o caso perdido.
    console.error('[webhook autentique]', e)
    return NextResponse.json({ ok: true })
  }
}
