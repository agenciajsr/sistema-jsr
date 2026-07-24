'use client'

// Chips executivos (churn/LTV) do Painel. O LTV é dinheiro → segue o olho de
// privacidade; o churn é percentual (proporção, não valor) e fica sempre visível.

import { MASCARA_MOEDA, useValoresVisiveis } from '@/lib/privacidade/use-valores-visiveis'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function ChipsExecutivos({
  churnMes,
  churn3m,
  ltv,
}: {
  churnMes: number | null
  churn3m: number | null
  ltv: number | null
}) {
  const { visivel } = useValoresVisiveis()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
        Churn do mês: {churnMes === null ? '—' : `${churnMes}%`}
        {churn3m !== null && ` · 3m ${churn3m}%`}
      </span>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
        LTV médio: {ltv === null ? '—' : visivel ? formatadorMoeda.format(ltv) : MASCARA_MOEDA}
      </span>
    </div>
  )
}
