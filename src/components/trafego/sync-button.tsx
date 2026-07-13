'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteId = searchParams.get('cliente') ?? undefined

  async function handleSync() {
    // Guard: sync manual só com cliente selecionado — evita puxar TODAS as contas
    // e abusar do limite da API da Meta.
    if (!clienteId) {
      toast.warning('Selecione um cliente antes de sincronizar — assim você puxa só as contas dele.')
      return
    }

    setSyncing(true)
    toast.info('Sincronizando dados da Meta... pode levar até 1 minuto.')

    try {
      // Chamada DIRETA (URL relativa) e AGUARDADA — sem depender de NEXT_PUBLIC_APP_URL
      // nem de "fire-and-forget" (o motivo de o sync antigo não completar).
      const res = await fetch(`/api/sync-meta?clienteId=${encodeURIComponent(clienteId)}`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.ok) {
        toast.error(data.error ?? 'Não foi possível sincronizar. Tente novamente.')
        return
      }

      toast.success(`Sincronização concluída! ${data.insights ?? 0} registros atualizados.`)
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
      {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
    </Button>
  )
}
