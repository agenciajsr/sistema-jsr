import Link from 'next/link'
import { Clock } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CorAgenda } from '@/lib/mock/dashboard-ref'
import { agendaHojeMock } from '@/lib/mock/dashboard-ref'

// Borda esquerda colorida por item (border-l-4).
const BORDA_COR: Record<CorAgenda, string> = {
  info: 'border-l-primary',
  success: 'border-l-chart-success',
  purple: 'border-l-chart-purple',
  orange: 'border-l-chart-warning',
}

const TEXTO_COR: Record<CorAgenda, string> = {
  info: 'text-primary',
  success: 'text-chart-success',
  purple: 'text-chart-purple',
  orange: 'text-chart-warning',
}

// Timeline da agenda do dia. Server component.
export function AgendaHoje() {
  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Agenda de Hoje</CardTitle>
        <Link href="/acompanhamento" className="text-xs font-medium text-primary hover:underline">
          Ver agenda
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {agendaHojeMock.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between gap-3 rounded-r-xl border-l-4 bg-background py-2.5 pl-3 pr-3',
              BORDA_COR[item.cor],
            )}
          >
            <div className="min-w-0">
              <p className={cn('text-sm font-semibold tabular-nums', TEXTO_COR[item.cor])}>
                {item.horario}
              </p>
              <p className="truncate text-sm font-medium">{item.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">/ {item.cliente}</p>
            </div>
            <Clock className="size-4 shrink-0 text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
