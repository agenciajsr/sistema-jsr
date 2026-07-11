'use client'

import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { Line, LineChart } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { resumoFinanceiroMock } from '@/lib/mock/dashboard-ref'

const chartConfig = {
  valor: { label: 'Lucro', color: 'var(--chart-purple)' },
} satisfies ChartConfig

const PERIODOS = ['Este mês', 'Últimos 3 meses', 'Este ano']

export function ResumoFinanceiro() {
  const { receitas, despesas, lucro, serie } = resumoFinanceiroMock

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Resumo Financeiro</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">
            Este mês
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PERIODOS.map((p) => (
              <DropdownMenuItem key={p}>{p}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Receitas</span>
            <span className="font-semibold tabular-nums">{receitas.valor}</span>
          </div>
          <Progress
            value={receitas.percent}
            className="h-2 bg-chart-success/15 [&>[data-slot=progress-indicator]]:bg-chart-success"
          />
          <p className="text-[11px] text-muted-foreground">{receitas.helper}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Despesas</span>
            <span className="font-semibold tabular-nums">{despesas.valor}</span>
          </div>
          <Progress
            value={despesas.percent}
            className="h-2 bg-chart-danger/15 [&>[data-slot=progress-indicator]]:bg-chart-danger"
          />
          <p className="text-[11px] text-muted-foreground">{despesas.helper}</p>
        </div>

        <div className="rounded-xl bg-[image:var(--gradient-surface)] p-4 ring-1 ring-inset ring-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Lucro Líquido</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-chart-success">
              <ArrowUpRight className="size-3" />
              {lucro.tendencia.valor}
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{lucro.valor}</p>
          <p className="text-[11px] text-muted-foreground">{lucro.helper}</p>
          <ChartContainer config={chartConfig} className="mt-2 h-[56px] w-full">
            <LineChart data={serie} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--chart-purple)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
