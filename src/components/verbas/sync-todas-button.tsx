'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

// Botão de sincronização da página de Verbas. A Verba mostra TODAS as contas —
// não há seletor de cliente. Chama /api/sync-meta SEM clienteId (todas as contas
// ativas), de forma DIRETA e AGUARDADA (sem fire-and-forget nem polling frágil).
// Sincronizar todas as contas pode levar alguns minutos (a Meta é lenta).
export function SyncTodasButton() {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()

  async function handleSync() {
    setSyncing(true)
    toast.info('Atualizando saldos e status das contas...')

    try {
      // tipo=saldos: sync LEVE (saldo + status), rápido. O sync pesado de campanhas
      // fica a cargo do cron diário — aqui a Verba só precisa de saldo/status atualizados.
      const res = await fetch('/api/sync-meta?tipo=saldos', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.ok) {
        toast.error(data.error ?? 'Não foi possível sincronizar. Tente novamente.')
        return
      }

      toast.success(`Saldos atualizados! ${data.contas ?? 0} contas.`)
      router.refresh()
    } catch {
      toast.error('Erro de conexão ao sincronizar. Tente novamente.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
      <RefreshCw className={`mr-2 size-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Sincronizando...' : 'Sincronizar contas'}
    </Button>
  )
}
