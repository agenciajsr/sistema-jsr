import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/dashboard/sparkline'
import type { KpiCor, Tendencia } from '@/lib/mock/dashboard-ref'

// Mapa cor → classes do ícone (círculo tonalizado) e cor do traço da sparkline.
const CONFIG_COR: Record<KpiCor, { icone: string; traco: string }> = {
  info: { icone: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/15', traco: 'var(--primary)' },
  success: { icone: 'bg-chart-success/10 text-chart-success ring-1 ring-inset ring-chart-success/15', traco: 'var(--chart-success)' },
  purple: { icone: 'bg-chart-purple/10 text-chart-purple ring-1 ring-inset ring-chart-purple/15', traco: 'var(--chart-purple)' },
  orange: { icone: 'bg-chart-warning/10 text-chart-warning ring-1 ring-inset ring-chart-warning/15', traco: 'var(--chart-warning)' },
  whatsapp: { icone: 'bg-chart-whatsapp/10 text-chart-whatsapp ring-1 ring-inset ring-chart-whatsapp/15', traco: 'var(--chart-whatsapp)' },
}

type KpiCardProps = {
  label: string
  valor: string
  icon: React.ComponentType<{ className?: string }>
  cor: KpiCor
  tendencia?: Tendencia
  helper?: string
  serie?: number[]
  progresso?: number
}

// Card da faixa superior do Painel: ícone colorido, valor grande, tendência e
// mini-visual (sparkline ou barra de progresso). Server component.
export function KpiCard({
  label,
  valor,
  icon: Icon,
  cor,
  tendencia,
  helper,
  serie,
  progresso,
}: KpiCardProps) {
  const config = CONFIG_COR[cor]

  return (
    <Card className="gap-3 border-none p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn('flex size-9 items-center justify-center rounded-xl', config.icone)}>
          <Icon className="size-4.5" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{valor}</span>
        {tendencia && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              tendencia.direcao === 'up' ? 'text-chart-success' : 'text-destructive',
            )}
          >
            {tendencia.direcao === 'up' ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {tendencia.valor}
          </span>
        )}
      </div>

      {helper && <p className="-mt-1 text-xs text-muted-foreground">{helper}</p>}

      {serie && serie.length > 0 && (
        <div className="mt-1">
          <Sparkline data={serie} cor={config.traco} tipo="area" />
        </div>
      )}
      {typeof progresso === 'number' && (
        <Progress
          value={progresso}
          className="mt-1 h-2 bg-chart-success/15 [&>[data-slot=progress-indicator]]:bg-chart-success"
        />
      )}
    </Card>
  )
}
