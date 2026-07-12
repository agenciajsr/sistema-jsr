'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { addAcompanhamento } from '@/actions/acompanhamento'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function AcompanhamentoForm({ clienteId }: { clienteId: string }) {
  const router = useRouter()
  const [nota, setNota] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    const limpo = nota.trim()
    if (!limpo) {
      toast.error('Escreva uma nota antes de salvar.')
      return
    }
    startTransition(async () => {
      const result = await addAcompanhamento(clienteId, limpo)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Nota adicionada.')
      setNota('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Escreva uma nota de acompanhamento..."
        disabled={isPending}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Salvando...' : 'Adicionar nota'}
        </Button>
      </div>
    </div>
  )
}
