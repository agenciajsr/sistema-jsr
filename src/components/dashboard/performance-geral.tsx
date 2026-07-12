'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

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
import type { ClientePerformance } from '@/lib/dashboard/data'

const chartConfig = {
  valor: { label: 'Investimento', color: 'var(--primary)' },
} satisfies ChartConfig

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')

type Props = {
  clientes: ClientePerformance[]
}

export function PerformanceGeral({ clientes }: Props) {
  const [selecionado, setSelecionado] = useState(0)
  const cliente = clientes[selecionado] ?? null

  if (clientes.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Performance Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum cliente com dados de campanha disponível.
          </p>
        </CardContent>
      </Card>
    )
  }

  const metricas = cliente
    ? [
        { id: 'investimento', label: 'Investimento', valor: formatadorMoeda.format(cliente.investimento) },
        { id: 'resultado', label: cliente.labelHeroi, valor: formatadorNumero.format(cliente.resultadoHeroi) },
        { id: 'cpa', label: 'CPA', valor: cliente.cpa !== null ? formatadorMoeda.format(cliente.cpa) : '-' },
        { id: 'roas', label: 'ROAS', valor: cliente.roas !== null ? `${cliente.roas.toFixed(2)}x` : '-' },
      ]
    : []

  const miniMetricas = cliente
    ? [
        { id: 'cliques', label: 'Cliques', valor: formatadorNumero.format(cliente.clicks) },
        { id: 'ctr', label: 'CTR', valor: cliente.ctr !== null ? `${cliente.ctr.toFixed(2)}%` : '-' },
        { id: 'cpm', label: 'CPM', valor: cliente.cpm !== null ? formatadorMoeda.format(cliente.cpm) : '-' },
        { id: 'impressoes', label: 'Impressões', valor: formatadorNumero.format(cliente.impressions) },
      ]
    : []

  const serieChart = (cliente?.serieSpendPorDia ?? []).map((p) => ({
    rotulo: p.date.slice(5), // MM-DD
    valor: p.spend,
  }))

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Performance Geral</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">
            {cliente?.nome ?? 'Selecionar'}
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {clientes.map((c, i) => (
              <DropdownMenuItem key={c.id} onClick={() => setSelecionado(i)}>
                {c.nome}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Métricas de topo */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {metricas.map((m) => (
            <div key={m.id}>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{m.valor}</p>
            </div>
          ))}
        </div>

        {/* Gráfico de linha azul */}
        {serieChart.length > 0 && (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={serieChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        )}

        {/* Mini-métricas de rodapé */}
        {miniMetricas.length > 0 && (
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            {miniMetricas.map((m) => (
              <div key={m.id}>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{m.valor}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
