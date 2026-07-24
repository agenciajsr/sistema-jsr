'use client'

// KPI "Clientes Ativos" do Painel seguindo o olho de privacidade: com valores
// ocultos, o número de clientes também fica mascarado (modo apresentação).

import { Users } from 'lucide-react'

import { KpiCard } from '@/components/dashboard/kpi-card'
import { useValoresVisiveis } from '@/lib/privacidade/use-valores-visiveis'
import type { Tendencia } from '@/lib/mock/dashboard-ref'

const formatadorNumero = new Intl.NumberFormat('pt-BR')

export function KpiClientesAtivos({
  total,
  tendencia,
}: {
  total: number
  tendencia?: Tendencia
}) {
  const { visivel } = useValoresVisiveis()

  return (
    <KpiCard
      label="Clientes Ativos"
      valor={visivel ? formatadorNumero.format(total) : '••'}
      icon={Users}
      cor="info"
      tendencia={visivel ? tendencia : undefined}
    />
  )
}
