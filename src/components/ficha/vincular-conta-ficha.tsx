'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'

import { vincularContaAoCliente } from '@/actions/trafego'
import { Button } from '@/components/ui/button'

type ContaNaoVinculada = {
  id: string
  nome: string
  metaAccountId: string
}

export function VincularContaFicha({
  clienteId,
  contasNaoVinculadas,
}: {
  clienteId: string
  contasNaoVinculadas: ContaNaoVinculada[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [contaId, setContaId] = useState('')

  if (contasNaoVinculadas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma conta de anúncio disponível para vincular.
      </p>
    )
  }

  function handleVincular() {
    if (!contaId) {
      toast.error('Selecione uma conta para vincular.')
      return
    }
    startTransition(async () => {
      const result = await vincularContaAoCliente(contaId, clienteId)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Conta vinculada ao cliente.')
      setContaId('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        value={contaId}
        onChange={(e) => setContaId(e.target.value)}
        className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <option value="">Selecione uma conta de anúncio...</option>
        {contasNaoVinculadas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome} ({c.metaAccountId})
          </option>
        ))}
      </select>
      <Button type="button" onClick={handleVincular} disabled={isPending}>
        <Link2 className="mr-2 size-4" />
        Vincular
      </Button>
    </div>
  )
}
