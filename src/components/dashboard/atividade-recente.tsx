import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { DollarSign, FileText, UserPlus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AtividadeItem } from '@/lib/dashboard/data'

type TipoAtividade = AtividadeItem['tipo']

const CONFIG_TIPO: Record<
  TipoAtividade,
  { classe: string; icon: React.ComponentType<{ className?: string }> }
> = {
  cliente: { classe: 'bg-chart-purple/10 text-chart-purple', icon: UserPlus },
  pagamento: { classe: 'bg-chart-success/10 text-chart-success', icon: DollarSign },
}

type Props = {
  atividades: AtividadeItem[]
}

export function AtividadeRecente({ atividades }: Props) {
  if (atividades.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma atividade recente registrada.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Atividade Recente</CardTitle>
        <Link href="/acompanhamento" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {atividades.map((a) => {
          const config = CONFIG_TIPO[a.tipo] ?? CONFIG_TIPO.cliente
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
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(a.tempo, { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
