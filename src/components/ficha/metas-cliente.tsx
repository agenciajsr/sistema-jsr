'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Target } from 'lucide-react'
import { toast } from 'sonner'

import { updateMetasCliente } from '@/actions/clientes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type MetasClienteProps = {
  clienteId: string
  metaCpa: string | null
  metaCpl: string | null
  metaRoas: string | null
  heroiLabel: string
}

export function MetasCliente({ clienteId, metaCpa, metaCpl, metaRoas }: MetasClienteProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cpa, setCpa] = useState(metaCpa ?? '')
  const [cpl, setCpl] = useState(metaCpl ?? '')
  const [roas, setRoas] = useState(metaRoas ?? '')

  function handleSalvar() {
    startTransition(async () => {
      const result = await updateMetasCliente(clienteId, {
        metaCpa: cpa.trim() === '' ? null : cpa,
        metaCpl: cpl.trim() === '' ? null : cpl,
        metaRoas: roas.trim() === '' ? null : roas,
      })
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Metas salvas.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-muted-foreground" />
        <h3 className="text-base font-medium">Metas do cliente</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Defina metas de performance para orientar os alertas de saúde. Deixe em branco para usar
        detecção automática por histórico.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="meta-cpa">Meta CPA (R$)</Label>
          <Input
            id="meta-cpa"
            inputMode="decimal"
            placeholder="Ex.: 30,00"
            value={cpa}
            onChange={(e) => setCpa(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Custo máximo por venda.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-cpl">Meta CPL (R$)</Label>
          <Input
            id="meta-cpl"
            inputMode="decimal"
            placeholder="Ex.: 15,00"
            value={cpl}
            onChange={(e) => setCpl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Custo máximo por lead.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-roas">Meta ROAS (x)</Label>
          <Input
            id="meta-roas"
            inputMode="decimal"
            placeholder="Ex.: 3,0"
            value={roas}
            onChange={(e) => setRoas(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Retorno alvo sobre o investimento.</p>
        </div>
      </div>

      <Button type="button" onClick={handleSalvar} disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar metas'}
      </Button>
    </div>
  )
}
