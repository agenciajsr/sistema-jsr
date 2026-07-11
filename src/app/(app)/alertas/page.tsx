import { AlertTriangle, Calendar, TrendingDown, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { alertasMock, type AlertaMock } from '@/lib/mock/dashboard'

const TIPO_ICON: Record<AlertaMock['tipo'], React.ComponentType<{ className?: string }>> = {
  verba: Wallet,
  contrato: Calendar,
  performance: TrendingDown,
}

const TIPO_LABEL: Record<AlertaMock['tipo'], string> = {
  verba: 'Verba',
  contrato: 'Contrato',
  performance: 'Performance',
}

export default function AlertasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-sm text-muted-foreground">
          Tudo que precisa de atenção, em um só lugar.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. Alertas de verba mínima e queda de
        performance entram na Fase 3; alertas de vencimento de contrato, na
        Fase 4.
      </MockNotice>

      <div className="space-y-3">
        {alertasMock.map((alerta) => {
          const Icon = TIPO_ICON[alerta.tipo]
          return (
            <Card key={alerta.id} className="border-none shadow-sm">
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={
                      alerta.severidade === 'critico'
                        ? 'mt-0.5 flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive'
                        : 'mt-0.5 flex size-9 items-center justify-center rounded-lg bg-chart-warning/10 text-chart-warning'
                    }
                  >
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{alerta.titulo}</p>
                      <Badge variant="outline">{TIPO_LABEL[alerta.tipo]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alerta.cliente} · {alerta.detalhe}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{alerta.quando}</p>
                  </div>
                </div>
                <Badge
                  variant={alerta.severidade === 'critico' ? 'destructive' : 'secondary'}
                  className="gap-1 shrink-0"
                >
                  <AlertTriangle className="size-3" />
                  {alerta.severidade === 'critico' ? 'Crítico' : 'Atenção'}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
