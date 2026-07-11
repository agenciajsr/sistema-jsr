'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, ChevronRight, Clock, Info } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getAlertas } from '@/actions/alertas'
import type { Alerta, SeveridadeAlerta, TipoAlerta } from '@/lib/alertas/types'

const CONFIG_SEVERIDADE: Record<
  SeveridadeAlerta,
  { classe: string; icon: React.ComponentType<{ className?: string }> }
> = {
  critico: { classe: 'bg-chart-danger/10 text-chart-danger', icon: AlertTriangle },
  atencao: { classe: 'bg-chart-warning/10 text-chart-warning', icon: Clock },
  info: { classe: 'bg-primary/10 text-primary', icon: Info },
}

const TIPO_HREF: Record<TipoAlerta, string> = {
  contrato_vencendo: '/alertas',
  pagamento_vencido: '/financeiro',
  cliente_inativo: '/clientes',
}

// Lista de alertas importantes com link por linha. Client component (painel e 'use client').
export function AlertasImportantes() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getAlertas().then((data) => {
      setAlertas(data)
      setLoaded(true)
    })
  }, [])

  const primeiros = alertas.slice(0, 4)

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Alertas Importantes</CardTitle>
        <Link href="/alertas" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {!loaded ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : primeiros.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle className="size-4.5" />
            </div>
            <p className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
              Nenhum alerta ativo
            </p>
          </div>
        ) : (
          primeiros.map((a) => {
            const config = CONFIG_SEVERIDADE[a.severidade]
            const href = TIPO_HREF[a.tipo]
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
                <p className="min-w-0 flex-1 text-sm font-medium">{a.titulo}</p>
                <Link
                  href={href}
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                >
                  Ver detalhes
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
