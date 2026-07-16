'use client'

import { useState } from 'react'
import { XCircle } from 'lucide-react'

import { MOTIVOS_PERDA, montarMotivoPerda } from '@/lib/crm/motivos-perda'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Dialog CONTROLADO de motivo de perda (quick 260716-khp) — substitui o
// window.prompt do kanban. Quem efetiva a perda (update otimista + action)
// é o chamador via onConfirm; cancelar/fechar NÃO move card nenhum.
//
// Não há RadioGroup no registry do repo — os motivos são botões estilizados
// com estado selecionado usando tokens do tema (funciona no dark, regra do
// dark mode: nunca cor hex fixa).

export function MotivoPerdaDialog({
  open,
  onCancel,
  onConfirm,
  nomeNegocio,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: (motivo: string) => void
  nomeNegocio?: string
}) {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState('')

  // Reset ao ABRIR (ajuste durante o render, padrão do repo para "resetar
  // estado quando a prop muda") — sem estado sujo entre uma perda e outra.
  const [abertoAntes, setAbertoAntes] = useState(open)
  if (abertoAntes !== open) {
    setAbertoAntes(open)
    if (open) {
      setSelecionado(null)
      setDetalhe('')
    }
  }

  const motivoFinal = selecionado ? montarMotivoPerda(selecionado, detalhe) : null

  return (
    <Dialog
      open={open}
      onOpenChange={(aberta) => {
        if (!aberta) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="size-4 text-red-500" />
            Motivo da perda
          </DialogTitle>
          <DialogDescription>
            {nomeNegocio
              ? `Por que o negócio "${nomeNegocio}" foi perdido?`
              : 'Por que este negócio foi perdido?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" role="radiogroup" aria-label="Motivo da perda">
          {MOTIVOS_PERDA.map((motivo) => {
            const ativo = selecionado === motivo
            return (
              <button
                key={motivo}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setSelecionado(motivo)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  ativo
                    ? 'border-primary bg-accent font-medium'
                    : 'border-border hover:bg-accent/50',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-3.5 shrink-0 rounded-full border',
                    ativo ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                />
                {motivo}
              </button>
            )
          })}
        </div>

        {selecionado === 'Outro' && (
          <div className="space-y-1.5">
            <Label htmlFor="detalhe-perda">Descreva o motivo</Label>
            <Textarea
              id="detalhe-perda"
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              placeholder="Ex.: cliente mudou de cidade"
              rows={3}
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={motivoFinal === null}
            onClick={() => {
              if (motivoFinal !== null) onConfirm(motivoFinal)
            }}
          >
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
