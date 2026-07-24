'use client'

import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { MASCARA_MOEDA, useValoresVisiveis } from '@/lib/privacidade/use-valores-visiveis'
import type { ResumoFinanceiroDash } from '@/lib/dashboard/data'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

type Props = {
  dados: ResumoFinanceiroDash | null
}

export function ResumoFinanceiro({ dados }: Props) {
  // Segue o mesmo olho de privacidade dos KPIs do topo do Painel: valores
  // ocultos por padrão (as barras de % continuam — mostram proporção, não valor).
  const { visivel } = useValoresVisiveis()
  const v = (valor: number) => (visivel ? formatadorMoeda.format(valor) : MASCARA_MOEDA)

  const receita = dados?.receita ?? 0
  const despesa = dados?.despesa ?? 0
  const lucro = dados?.lucro ?? 0
  const mrr = dados?.mrrAtual ?? 0
  const percentRecebido = dados?.percentRecebido ?? 0
  const percentDespesa = mrr > 0 ? Math.min(Math.round((despesa / mrr) * 100), 100) : 0

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Resumo Financeiro</CardTitle>
        <Link href="/financeiro" className="text-xs font-medium text-primary hover:underline">
          Ver detalhes
        </Link>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Receitas</span>
            <span className="font-semibold tabular-nums">{v(receita)}</span>
          </div>
          <Progress
            value={Math.min(percentRecebido, 100)}
            className="h-2 bg-chart-success/15 [&>[data-slot=progress-indicator]]:bg-chart-success"
          />
          <p className="text-[11px] text-muted-foreground">{percentRecebido}% do MRR previsto</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Despesas</span>
            <span className="font-semibold tabular-nums">{v(despesa)}</span>
          </div>
          <Progress
            value={percentDespesa}
            className="h-2 bg-chart-danger/15 [&>[data-slot=progress-indicator]]:bg-chart-danger"
          />
          <p className="text-[11px] text-muted-foreground">{percentDespesa}% do MRR</p>
        </div>

        <div className="rounded-xl bg-[image:var(--gradient-surface)] p-4 ring-1 ring-inset ring-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Lucro Líquido</span>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {v(lucro)}
          </p>
          <p className="text-[11px] text-muted-foreground">Receitas − Despesas do mês atual</p>
        </div>
      </CardContent>
    </Card>
  )
}
