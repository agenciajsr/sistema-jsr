'use client'

// Painel lateral "Organizar" (referência: imagem 2): liga/desliga e reordena
// as métricas da grade de KPIs. Reordenação por drag nativo HTML (sem lib nova).
// Feature 1 (semáforo): cada métrica ATIVA ganha a linha de meta — "bom até /
// ruim acima de" (invertido para métricas maior-melhor) + toggle. Salva no
// MESMO jsonb kpis, junto com a visibilidade.

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
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CATALOGO_METRICAS, type MetricaId } from '@/lib/trafego/metricas'
import {
  METAS_PADRAO_POR_CLASSE,
  direcaoDaMetrica,
  type MetaMetrica,
} from '@/lib/trafego/semaforo'
import type { ClasseObjetivo } from '@/lib/trafego/aggregate'
import type { PreferenciaKpi } from '@/actions/trafego'

const LABEL_POR_ID = new Map<string, string>(CATALOGO_METRICAS.map((m) => [m.id, m.label]))

type OrganizarSheetProps = {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  prefs: PreferenciaKpi[]
  onPrefsChange: (novas: PreferenciaKpi[]) => void
  clienteNome: string
  classe: ClasseObjetivo | null
}

export function OrganizarSheet({
  aberto,
  onAbertoChange,
  prefs,
  onPrefsChange,
  clienteNome,
  classe,
}: OrganizarSheetProps) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  // Rascunho local dos inputs de meta — só persiste no blur (evita um server
  // action por tecla digitada).
  const [rascunho, setRascunho] = useState<Record<string, { bom: string; ruim: string }>>({})

  const padraoDaClasse: Partial<Record<MetricaId, MetaMetrica>> = classe
    ? METAS_PADRAO_POR_CLASSE[classe]
    : {}

  function alternar(id: string, ativo: boolean) {
    onPrefsChange(prefs.map((p) => (p.id === id ? { ...p, ativo } : p)))
  }

  /** Meta efetiva exibida: salva na preferência ou default da classe. */
  function metaDaLinha(p: PreferenciaKpi): { bom: number; ruim: number; ativa: boolean } | null {
    if (p.meta) return p.meta
    const padrao = padraoDaClasse[p.id as MetricaId]
    return padrao ? { ...padrao, ativa: true } : null
  }

  function alternarMeta(p: PreferenciaKpi, ativa: boolean) {
    const base = metaDaLinha(p) ?? { bom: 0, ruim: 0, ativa }
    onPrefsChange(
      prefs.map((x) => (x.id === p.id ? { ...x, meta: { ...base, ativa } } : x)),
    )
  }

  function editarMeta(id: string, campo: 'bom' | 'ruim', texto: string) {
    setRascunho((r) => {
      const p = prefs.find((x) => x.id === id)
      const atual = r[id] ?? {
        bom: p ? String(metaDaLinha(p)?.bom ?? '') : '',
        ruim: p ? String(metaDaLinha(p)?.ruim ?? '') : '',
      }
      return { ...r, [id]: { ...atual, [campo]: texto } }
    })
  }

  /** Persiste a meta da linha no blur dos inputs (número pt-BR com vírgula ok). */
  function confirmarMeta(p: PreferenciaKpi) {
    const r = rascunho[p.id]
    if (!r) return
    const base = metaDaLinha(p)
    const num = (t: string, fallback: number | undefined) => {
      const v = parseFloat(t.replace(',', '.'))
      return Number.isFinite(v) ? v : fallback ?? 0
    }
    const bom = num(r.bom, base?.bom)
    const ruim = num(r.ruim, base?.ruim)
    onPrefsChange(
      prefs.map((x) =>
        x.id === p.id ? { ...x, meta: { bom, ruim, ativa: base?.ativa ?? true } } : x,
      ),
    )
    setRascunho((atual) => {
      const { [p.id]: _, ...resto } = atual
      return resto
    })
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Organizar</SheetTitle>
          <SheetDescription>
            Arraste para reordenar e use o interruptor para mostrar ou esconder cada métrica.
            Nas métricas ativas, configure a <span className="font-medium text-foreground">meta do semáforo</span>.
            Tudo fica salvo para <span className="font-medium text-foreground">{clienteNome}</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1 px-4 pb-6">
          {prefs.map((p) => {
            const meta = metaDaLinha(p)
            const menorMelhor = direcaoDaMetrica(p.id as MetricaId) === 'menor'
            const r = rascunho[p.id]
            return (
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
                  'rounded-lg border border-transparent px-2 py-2 transition-colors',
                  sobre === p.id && arrastando !== p.id && 'border-primary/40 bg-primary/5',
                  arrastando === p.id && 'opacity-50',
                )}
              >
                <div className="flex cursor-grab items-center gap-2 active:cursor-grabbing">
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

                {/* Linha de meta do semáforo — só nas métricas visíveis */}
                {p.ativo && (
                  <div
                    className="mt-1.5 flex items-center gap-2 pl-6"
                    // Inputs dentro de linha draggable: impedir que o drag roube o foco.
                    draggable
                    onDragStart={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    <Switch
                      checked={meta?.ativa ?? false}
                      onCheckedChange={(v) => alternarMeta(p, v)}
                      className="scale-75"
                      aria-label={`Semáforo de ${LABEL_POR_ID.get(p.id) ?? p.id}`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {menorMelhor ? 'bom até' : 'bom a partir de'}
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={r?.bom ?? (meta ? String(meta.bom) : '')}
                      onChange={(e) => editarMeta(p.id, 'bom', e.target.value)}
                      onBlur={() => confirmarMeta(p)}
                      disabled={!meta?.ativa}
                      className="h-7 w-16 px-2 text-xs tabular-nums"
                      aria-label="Meta: bom"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {menorMelhor ? 'ruim acima de' : 'ruim abaixo de'}
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={r?.ruim ?? (meta ? String(meta.ruim) : '')}
                      onChange={(e) => editarMeta(p.id, 'ruim', e.target.value)}
                      onBlur={() => confirmarMeta(p)}
                      disabled={!meta?.ativa}
                      className="h-7 w-16 px-2 text-xs tabular-nums"
                      aria-label="Meta: ruim"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
