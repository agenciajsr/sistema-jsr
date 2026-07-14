import { NextResponse } from 'next/server'

import { sincronizarTudoMeta } from '@/lib/meta/sync'
import { avaliarEPersistirAlertas, type ResumoAvaliacao } from '@/lib/alertas/persistir'

// Rota chamada pelo Vercel Cron (GET) 1×/dia. Descobre/atualiza as contas da Meta
// e sincroniza insights + saldo de todas as contas ativas. Sem sessão de usuário —
// a proteção é feita por CRON_SECRET (Authorization: Bearer). Sincronizar todas as
// contas pode levar minutos (a Meta é lenta), por isso maxDuration 300.
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 })
    }
  } else {
    console.warn('[cron/sync-meta] CRON_SECRET não configurado — rota desprotegida.')
  }

  try {
    const { contas, insights } = await sincronizarTudoMeta()

    // Avaliação de alertas proativos após o sync: try/catch PRÓPRIO — uma
    // falha aqui NÃO pode quebrar a resposta do sync que acabou de funcionar.
    let alertasResumo: ResumoAvaliacao | null = null
    try {
      alertasResumo = await avaliarEPersistirAlertas()
    } catch (erroAlertas) {
      console.error('[cron/sync-meta] falha ao avaliar alertas — seguindo sem alertas', erroAlertas)
    }

    return NextResponse.json(
      alertasResumo
        ? { ok: true, contas, insights, alertas: alertasResumo }
        : { ok: true, contas, insights },
    )
  } catch (err) {
    console.error('[cron/sync-meta] Erro:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
