import { Target, DollarSign, TrendingUp, Trophy, AlertTriangle, PhoneOff } from 'lucide-react'

import { StatCard } from '@/components/stat-card'
import type { KpisCrm } from '@/lib/crm/dados'

// Faixa de 6 KPIs do CRM — reutiliza o StatCard do projeto (mesmo visual do
// dashboard). Server-friendly: recebe os numeros ja calculados, sem estado.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function KpisCrm({ kpis }: { kpis: KpisCrm }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Oportunidades"
        value={String(kpis.totalOportunidades)}
        icon={Target}
        color="primary"
      />
      <StatCard
        label="Valor em aberto"
        value={formatoBRL.format(kpis.valorOrigem)}
        icon={DollarSign}
        color="primary"
      />
      <StatCard
        label="Taxa de conversao"
        value={`${kpis.taxaConversao}%`}
        icon={TrendingUp}
        color="success"
      />
      <StatCard label="Ganhas" value={String(kpis.ganhas)} icon={Trophy} color="success" />
      <StatCard
        label="Atividades atrasadas"
        value={String(kpis.atividadesAtrasadas)}
        icon={AlertTriangle}
        color={kpis.atividadesAtrasadas > 0 ? 'warning' : 'primary'}
      />
      <StatCard
        label="Sem contato (+7d)"
        value={String(kpis.semContato)}
        icon={PhoneOff}
        color={kpis.semContato > 0 ? 'warning' : 'primary'}
      />
    </div>
  )
}
