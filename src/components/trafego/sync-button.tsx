'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { triggerMetaSync } from '@/actions/trafego'

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteId = searchParams.get('cliente') ?? undefined
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  async function handleSync() {
    setSyncing(true)
    const result = await triggerMetaSync(clienteId)

    if ('error' in result) {
      toast.error(result.error)
      setSyncing(false)
      return
    }

    toast.info('Sincronizando dados da Meta... Aguarde.')

    // Polling: verificar a cada 5s se a sync terminou (max 90s)
    const startTime = Date.now()
    const initialSyncTime = new Date().toISOString()

    pollRef.current = setInterval(async () => {
      // Timeout de 90s
      if (Date.now() - startTime > 90_000) {
        stopPolling()
        setSyncing(false)
        toast.success('Sincronização pode ter finalizado. Recarregando...')
        router.refresh()
        return
      }

      try {
        const res = await fetch(`/api/sync-meta/status?after=${initialSyncTime}`)
        const data = await res.json()
        if (data.done) {
          stopPolling()
          setSyncing(false)
          toast.success(`Sincronização concluída! ${data.insights ?? ''} registros atualizados.`)
          router.refresh()
        }
      } catch {
        // Ignorar erros de polling
      }
    }, 5000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
      <RefreshCw className={`mr-2 size-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
    </Button>
  )
}
