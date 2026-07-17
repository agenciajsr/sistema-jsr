'use client'

// Score de Saúde do cliente (Feature 1): agora derivado do SEMÁFORO de metas
// (verde=100/amarelo=60/vermelho=20 ponderado pelo gasto por campanha) e
// CLICÁVEL — popover com o breakdown por métrica monitorada explica o número.

import { ChevronDown } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CATALOGO_METRICAS, type FormatoMetrica } from '@/lib/trafego/metricas'
import type { ItemBreakdown, StatusMeta } from '@/lib/trafego/semaforo'

type HealthScoreClienteProps = {
  score: number
  rotulo: string
  /** Breakdown por métrica (semáforo). Sem itens = badge estático (legado). */
  breakdown?: ItemBreakdown[]
}

// Cor por faixa de saúde: verde (>=80), âmbar (>=50), vermelho (<50).
function classesPorScore(score: number): string {
  if (score >= 80) return 'bg-chart-success/10 text-chart-success border-chart-success/30'
  if (score >= 50) return 'bg-chart-warning/10 text-chart-warning border-chart-warning/30'
  return 'bg-destructive/10 text-destructive border-destructive/30'
}

const COR_STATUS: Record<StatusMeta, string> = {
  bom: 'bg-chart-success',
  atencao: 'bg-chart-warning',
  ruim: 'bg-destructive',
  sem_dados: 'bg-muted-foreground/40',
}

const LABEL_STATUS: Record<StatusMeta, string> = {
  bom: 'Bom',
  atencao: 'Atenção',
  ruim: 'Ruim',
  sem_dados: 'Sem dados',
}

const CATALOGO = new Map(CATALOGO_METRICAS.map((m) => [m.id, m]))

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatar(valor: number | null, formato: FormatoMetrica): string {
  if (valor === null) return '—'
  switch (formato) {
    case 'moeda':
      return fmtMoeda.format(valor)
    case 'pct':
      return `${fmtPct.format(valor)}%`
    case 'multiplicador':
      return `${fmtPct.format(valor)}x`
    default:
      return new Intl.NumberFormat('pt-BR').format(valor)
  }
}

export function HealthScoreCliente({ score, rotulo, breakdown }: HealthScoreClienteProps) {
  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1',
        classesPorScore(score),
        breakdown && breakdown.length > 0 && 'cursor-pointer transition-opacity hover:opacity-80',
      )}
    >
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <span className="text-xs font-medium">Saúde: {rotulo}</span>
      {breakdown && breakdown.length > 0 && <ChevronDown className="size-3 opacity-70" />}
    </div>
  )

  if (!breakdown || breakdown.length === 0) return badge

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Ver como o score é calculado">
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Como o score é calculado — status de cada métrica monitorada no período:
        </p>
        <ul className="space-y-1.5">
          {breakdown.map((item) => {
            const meta = CATALOGO.get(item.id)
            if (!meta) return null
            return (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <span className={cn('size-2 shrink-0 rounded-full', COR_STATUS[item.status])} />
                <span className="flex-1 truncate">{meta.label}</span>
                <span className="tabular-nums font-medium">{formatar(item.valor, meta.formato)}</span>
                <span className="w-16 text-right text-xs text-muted-foreground">
                  {LABEL_STATUS[item.status]}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
          Verde=100 · Amarelo=60 · Vermelho=20, ponderado pelo gasto de cada campanha.
          Metas configuráveis no botão “Organizar”.
        </p>
      </PopoverContent>
    </Popover>
  )
}
