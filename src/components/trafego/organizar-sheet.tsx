'use client'

// Painel lateral "Organizar" (referência: imagem 2): liga/desliga e reordena
// as métricas da grade de KPIs. Reordenação por drag nativo HTML (sem lib nova).

import { useState } from 'react'
import { GripVertical } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { CATALOGO_METRICAS, type MetricaId } from '@/lib/trafego/metricas'
import type { PreferenciaKpi } from '@/actions/trafego'

const LABEL_POR_ID = new Map<string, string>(CATALOGO_METRICAS.map((m) => [m.id, m.label]))

type OrganizarSheetProps = {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  prefs: PreferenciaKpi[]
  onPrefsChange: (novas: PreferenciaKpi[]) => void
  clienteNome: string
}

export function OrganizarSheet({
  aberto,
  onAbertoChange,
  prefs,
  onPrefsChange,
  clienteNome,
}: OrganizarSheetProps) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

  function alternar(id: string, ativo: boolean) {
    onPrefsChange(prefs.map((p) => (p.id === id ? { ...p, ativo } : p)))
  }

  function soltar(idDestino: string) {
    if (!arrastando || arrastando === idDestino) {
      setArrastando(null)
      setSobre(null)
      return
    }
    const novas = [...prefs]
    const de = novas.findIndex((p) => p.id === arrastando)
    const para = novas.findIndex((p) => p.id === idDestino)
    if (de === -1 || para === -1) return
    const [movida] = novas.splice(de, 1)
    novas.splice(para, 0, movida)
    onPrefsChange(novas)
    setArrastando(null)
    setSobre(null)
  }

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Organizar</SheetTitle>
          <SheetDescription>
            Arraste para reordenar e use o interruptor para mostrar ou esconder cada métrica.
            Estas métricas ficam salvas para <span className="font-medium text-foreground">{clienteNome}</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1 px-4 pb-6">
          {prefs.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setArrastando(p.id)}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(p.id)
              }}
              onDragLeave={() => setSobre((s) => (s === p.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault()
                soltar(p.id)
              }}
              onDragEnd={() => {
                setArrastando(null)
                setSobre(null)
              }}
              className={cn(
                'flex cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors active:cursor-grabbing',
                sobre === p.id && arrastando !== p.id && 'border-primary/40 bg-primary/5',
                arrastando === p.id && 'opacity-50',
              )}
            >
              <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
              <span className="flex-1 truncate text-sm">
                {LABEL_POR_ID.get(p.id as MetricaId) ?? p.id}
              </span>
              <Switch
                checked={p.ativo}
                onCheckedChange={(v) => alternar(p.id, v)}
                aria-label={`Mostrar ${LABEL_POR_ID.get(p.id) ?? p.id}`}
              />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
