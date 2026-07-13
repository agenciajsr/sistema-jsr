import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { sincronizarContasMeta, sincronizarVerbas } from '@/lib/meta/sync'

// Sincronizar as contas pode levar ~20s por conta (a Meta é lenta). Damos folga
// até 5 min para o caso "todas as contas". Chamada direta pelo botão (await).
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const clienteId = request.nextUrl.searchParams.get('clienteId')
  const tipo = request.nextUrl.searchParams.get('tipo')

  try {
    // tipo=saldos: sync LEVE (só saldo + status), rápido e confiável — usado pelo
    // botão da página de Verbas. Evita o sync pesado de insights (~3 min) que não
    // completa numa requisição do navegador.
    if (tipo === 'saldos') {
      const { contas } = await sincronizarVerbas()
      return NextResponse.json({ ok: true, contas, insights: 0 })
    }

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
