'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { triggerMetaSync } from '@/actions/trafego'

export function SyncButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSync() {
    startTransition(async () => {
      const result = await triggerMetaSync()

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Sincronizacao iniciada. Os dados serao atualizados em alguns minutos.')
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
      <RefreshCw className={`mr-2 size-4 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Sincronizando...' : 'Sincronizar agora'}
    </Button>
  )
}
