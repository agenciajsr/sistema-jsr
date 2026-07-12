'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const chartConfig = {
  spend: { label: 'Verba', color: 'var(--primary)' },
} satisfies ChartConfig

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function rotuloDia(iso: string): string {
  // 'YYYY-MM-DD' -> 'DD/MM' sem depender de timezone
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function GraficoVerba({ serie }: { serie: { date: string; spend: number }[] }) {
  const dados = serie.map((p) => ({ ...p, rotulo: rotuloDia(p.date) }))

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillVerba" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          fontSize={11}
          tickFormatter={(v: number) => formatadorMoeda.format(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatadorMoeda.format(Number(value))}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="spend"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill="url(#fillVerba)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
