import { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, PhoneOff } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { KpisCrm as KpisCrmTipo } from '@/lib/crm/dados'

// Faixa de 6 KPIs do CRM. Server-friendly: recebe os numeros ja calculados.
//
// KpiCompacto e LOCAL de proposito: o numero do StatCard compartilhado e grande
// demais para 6 KPIs numa linha so e nao bate com o mockup do CRM. Alterar o
// StatCard mexeria no dashboard (que ninguem pediu para mudar), entao a variacao
// densa vive aqui — mesmo Card/borda/sombra do resto da UI.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type CorKpi = 'primary' | 'success' | 'warning'

const CORES: Record<CorKpi, string> = {
  primary: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/15',
  success: 'bg-chart-success/10 text-chart-success ring-1 ring-inset ring-chart-success/15',
  warning: 'bg-chart-warning/10 text-chart-warning ring-1 ring-inset ring-chart-warning/15',
}

function KpiCompacto({
  label,
  value,
  icon: Icon,
  color = 'primary',
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color?: CorKpi
}) {
  return (
    <Card className="gap-2 border-none p-4 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div
          className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', CORES[color])}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
    </Card>
  )
}

export function KpisCrm({ kpis }: { kpis: KpisCrmTipo }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <KpiCompacto
        label="Oportunidades"
        value={String(kpis.totalOportunidades)}
        icon={Target}
        color="primary"
      />
      <KpiCompacto
        label="Valor em aberto"
        value={formatoBRL.format(kpis.valorOrigem)}
        icon={DollarSign}
        color="primary"
      />
      <KpiCompacto
        label="Taxa de conversao"
        value={`${kpis.taxaConversao}%`}
        icon={TrendingUp}
        color="success"
      />
      <KpiCompacto label="Ganhas" value={String(kpis.ganhas)} icon={Trophy} color="success" />
      <KpiCompacto
        label="Atividades atrasadas"
        value={String(kpis.atividadesAtrasadas)}
        icon={AlertTriangle}
        color={kpis.atividadesAtrasadas > 0 ? 'warning' : 'primary'}
      />
      <KpiCompacto
        label="Sem contato (+7d)"
        value={String(kpis.semContato)}
        icon={PhoneOff}
        color={kpis.semContato > 0 ? 'warning' : 'primary'}
      />
    </div>
  )
}
