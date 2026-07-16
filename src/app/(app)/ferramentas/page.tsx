import { redirect } from 'next/navigation'

import { AutomacoesLista } from '@/components/ferramentas/automacoes-lista'
import { getAutomacoes } from '@/lib/crm/automacoes'
import { getCurrentUser } from '@/lib/auth/session'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 60s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

export default async function FerramentasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  let automacoes: Awaited<ReturnType<typeof getAutomacoes>> = []
  try {
    automacoes = await getAutomacoes()
  } catch (e) {
    console.error('[FerramentasPage]', e)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ferramentas</h1>
        <p className="text-sm text-muted-foreground">
          Central de automações da agência: ligue, desligue e edite as mensagens.
        </p>
      </div>
      <AutomacoesLista automacoes={automacoes} />
    </div>
  )
}
