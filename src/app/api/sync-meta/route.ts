import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { sincronizarContasMeta } from '@/lib/meta/sync'

// Sincronizar as contas pode levar ~20s por conta (a Meta é lenta). Damos folga
// até 5 min para o caso "todas as contas". Chamada direta pelo botão (await).
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const clienteId = request.nextUrl.searchParams.get('clienteId')

  try {
    const { contas, insights } = await sincronizarContasMeta(clienteId)
    return NextResponse.json({ ok: true, contas, insights })
  } catch (err) {
    console.error('[sync-meta] Erro geral:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}
