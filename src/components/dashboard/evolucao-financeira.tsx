'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { EvolucaoMensal } from '@/lib/dashboard/data'

const chartConfig = {
  receita: { label: 'Receita', color: 'var(--chart-success)' },
  despesa: { label: 'Despesa', color: 'var(--chart-destructive, var(--destructive))' },
} satisfies ChartConfig

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

function formatarMes(mes: string) {
  const [, m] = mes.split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return nomes[parseInt(m, 10) - 1] ?? m
}

type Props = {
  dados: EvolucaoMensal[]
}

export function EvolucaoFinanceira({ dados }: Props) {
  if (dados.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Evolução Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados financeiros para exibir tendência.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = dados.map((d) => ({
    mes: formatarMes(d.mes),
    receita: d.receita,
    despesa: d.despesa,
  }))

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">Evolução Financeira</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full sm:h-[260px]">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={10}
              tickFormatter={(v) => formatadorMoeda.format(v)}
              width={70}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="receita"
              stroke="var(--chart-success)"
              fill="var(--chart-success)"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="despesa"
              stroke="var(--destructive)"
              fill="var(--destructive)"
              fillOpacity={0.08}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
