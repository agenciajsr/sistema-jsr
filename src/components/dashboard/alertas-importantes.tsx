import Link from 'next/link'
import { AlertTriangle, ChevronRight, Clock, DollarSign, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SeveridadeAlerta } from '@/lib/mock/dashboard-ref'
import { alertasImportantesMock } from '@/lib/mock/dashboard-ref'

const CONFIG_SEVERIDADE: Record<
  SeveridadeAlerta,
  { classe: string; icon: React.ComponentType<{ className?: string }> }
> = {
  danger: { classe: 'bg-chart-danger/10 text-chart-danger', icon: AlertTriangle },
  warning: { classe: 'bg-chart-warning/10 text-chart-warning', icon: Clock },
  orange: { classe: 'bg-chart-warning/10 text-chart-warning', icon: TrendingUp },
  info: { classe: 'bg-primary/10 text-primary', icon: DollarSign },
}

// Lista de alertas importantes com link por linha. Server component.
export function AlertasImportantes() {
  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Alertas Importantes</CardTitle>
        <Link href="/alertas" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertasImportantesMock.map((a) => {
          const config = CONFIG_SEVERIDADE[a.cor]
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  config.classe,
                )}
              >
                <config.icon className="size-4.5" />
              </div>
              <p className="min-w-0 flex-1 text-sm font-medium">{a.texto}</p>
              <Link
                href={a.href}
                className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline"
              >
                {a.link}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
