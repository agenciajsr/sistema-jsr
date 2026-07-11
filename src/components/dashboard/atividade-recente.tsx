import Link from 'next/link'
import { DollarSign, FileText, Pause, UserPlus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TipoAtividade } from '@/lib/mock/dashboard-ref'
import { atividadeRecenteMock } from '@/lib/mock/dashboard-ref'

const CONFIG_TIPO: Record<
  TipoAtividade,
  { classe: string; icon: React.ComponentType<{ className?: string }> }
> = {
  relatorio: { classe: 'bg-primary/10 text-primary', icon: FileText },
  pagamento: { classe: 'bg-chart-success/10 text-chart-success', icon: DollarSign },
  campanha: { classe: 'bg-chart-warning/10 text-chart-warning', icon: Pause },
  cliente: { classe: 'bg-chart-purple/10 text-chart-purple', icon: UserPlus },
}

// Feed de atividade recente. Server component.
export function AtividadeRecente() {
  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Atividade Recente</CardTitle>
        <Link href="/acompanhamento" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {atividadeRecenteMock.map((a) => {
          const config = CONFIG_TIPO[a.tipo]
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-xl p-2">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  config.classe,
                )}
              >
                <config.icon className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.tempo}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
