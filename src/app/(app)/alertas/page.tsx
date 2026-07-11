import { Calendar, CheckCircle, UserX, Wallet, AlertTriangle, Info } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getAlertas } from '@/actions/alertas'
import type { Alerta, TipoAlerta, SeveridadeAlerta } from '@/lib/alertas/types'

const TIPO_ICON: Record<TipoAlerta, React.ComponentType<{ className?: string }>> = {
  contrato_vencendo: Calendar,
  pagamento_vencido: Wallet,
  cliente_inativo: UserX,
}

const TIPO_LABEL: Record<TipoAlerta, string> = {
  contrato_vencendo: 'Contrato',
  pagamento_vencido: 'Pagamento',
  cliente_inativo: 'Cliente',
}

const SEVERIDADE_CONFIG: Record<
  SeveridadeAlerta,
  { badgeClass: string; iconBgClass: string; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  critico: {
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
    iconBgClass: 'bg-destructive/10 text-destructive',
    label: 'Critico',
    icon: AlertTriangle,
  },
  atencao: {
    badgeClass: 'border-chart-warning/30 bg-chart-warning/10 text-chart-warning',
    iconBgClass: 'bg-chart-warning/10 text-chart-warning',
    label: 'Atencao',
    icon: AlertTriangle,
  },
  info: {
    badgeClass: 'border-primary/30 bg-primary/10 text-primary',
    iconBgClass: 'bg-primary/10 text-primary',
    label: 'Info',
    icon: Info,
  },
}

export default async function AlertasPage() {
  const alertas = await getAlertas()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-sm text-muted-foreground">
          Tudo que precisa de atencao, em um so lugar.
        </p>
      </div>

      {alertas.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="size-6" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum alerta no momento — tudo em ordem.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alertas.map((alerta) => {
            const Icon = TIPO_ICON[alerta.tipo]
            const sevConfig = SEVERIDADE_CONFIG[alerta.severidade]
            return (
              <Card key={alerta.id} className="border-none shadow-sm">
                <CardContent className="flex items-start justify-between gap-4 py-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex size-9 items-center justify-center rounded-lg ${sevConfig.iconBgClass}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{alerta.titulo}</p>
                        <Badge variant="outline">{TIPO_LABEL[alerta.tipo]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alerta.clienteNome} &middot; {alerta.detalhe}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {alerta.dataRelevante}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`gap-1 shrink-0 ${sevConfig.badgeClass}`}
                  >
                    <sevConfig.icon className="size-3" />
                    {sevConfig.label}
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
