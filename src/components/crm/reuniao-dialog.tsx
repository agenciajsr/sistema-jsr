'use client'

import { useState } from 'react'
import { CalendarClock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Dialog CONTROLADO de agendamento de reunião (quick 260716-kq1) — abre quando
// um card é arrastado para a coluna "Reunião agendada". Quem move o card e
// dispara a action é o chamador via onConfirm; cancelar/fechar NÃO move nada
// (mesmo contrato do MotivoPerdaDialog).

export type ReuniaoValores = {
  titulo?: string
  data: string // YYYY-MM-DD
  horaInicio: string // HH:mm
  horaFim: string // HH:mm
  observacao?: string
}

/** 'YYYY-MM-DD' de hoje no fuso local (inputs type=date). */
function hojeLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** ISO local a partir de date + time — Date.parse entende 'YYYY-MM-DDTHH:mm'. */
function montarIso(data: string, hora: string): string {
  return data && hora ? `${data}T${hora}` : ''
}

/** Duracao legivel entre inicio e fim ('30m', '1h 15m'); invalida = '—'. */
function duracao(inicioIso: string, fimIso: string): string {
  const ini = Date.parse(inicioIso)
  const fim = Date.parse(fimIso)
  if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) return '—'
  const minutos = Math.round((fim - ini) / 60000)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function ReuniaoDialog({
  open,
  nomeNegocio,
  onCancel,
  onConfirm,
}: {
  open: boolean
  nomeNegocio?: string
  onCancel: () => void
  onConfirm: (valores: ReuniaoValores) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeLocal)
  const [horaInicio, setHoraInicio] = useState('13:00')
  const [horaFim, setHoraFim] = useState('13:30')
  const [observacao, setObservacao] = useState('')

  // Reset ao ABRIR (ajuste durante o render, padrão do repo para "resetar
  // estado quando a prop muda") — sem estado sujo entre um agendamento e outro.
  const [abertoAntes, setAbertoAntes] = useState(open)
  if (abertoAntes !== open) {
    setAbertoAntes(open)
    if (open) {
      setTitulo('')
      setData(hojeLocal())
      setHoraInicio('13:00')
      setHoraFim('13:30')
      setObservacao('')
    }
  }

  const valido = Boolean(data && horaInicio && horaFim && horaFim > horaInicio)

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
            <CalendarClock className="size-4 text-primary" />
            Agendar reunião
          </DialogTitle>
          <DialogDescription>
            {nomeNegocio
              ? `A atividade de reunião será criada no negócio "${nomeNegocio}" e o evento correspondente no Google Calendar.`
              : 'A atividade de reunião será criada no card do lead e o evento correspondente no Google Calendar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reuniao-titulo">Título (opcional)</Label>
            <Input
              id="reuniao-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={nomeNegocio ? `Reunião — ${nomeNegocio}` : 'Reunião'}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Data e horário</Label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  aria-label="Data da reunião"
                />
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    aria-label="Hora de início"
                  />
                  <Input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    aria-label="Hora de fim"
                  />
                </div>
              </div>
              <div className="flex w-16 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">
                {duracao(montarIso(data, horaInicio), montarIso(data, horaFim))}
              </div>
            </div>
            {!valido && (
              <p className="text-xs text-muted-foreground">
                Informe data e horários — o fim deve ser depois do início.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reuniao-observacao">Observação (opcional)</Label>
            <Textarea
              id="reuniao-observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: alinhar escopo da campanha"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!valido}
            onClick={() => {
              if (!valido) return
              onConfirm({
                titulo: titulo.trim() || undefined,
                data,
                horaInicio,
                horaFim,
                observacao: observacao.trim() || undefined,
              })
            }}
          >
            Agendar reunião
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
