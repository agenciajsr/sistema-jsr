'use client'

import { ArrowDownRight, ArrowUpRight, ChevronDown } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { performanceGeralMock } from '@/lib/mock/dashboard-ref'

const chartConfig = {
  valor: { label: 'Investimento', color: 'var(--primary)' },
} satisfies ChartConfig

// Clientes de exemplo para o seletor (placeholder visual).
const CLIENTES = ['Clínica Bella', 'Pizzaria do João', 'Academia Evolution', 'Moda Feminina Store']

function Seta({ direcao }: { direcao: 'up' | 'down' }) {
  return direcao === 'up' ? (
    <ArrowUpRight className="size-3" />
  ) : (
    <ArrowDownRight className="size-3" />
  )
}

export function PerformanceGeral() {
  const { clienteSelecionado, metricas, serie, miniMetricas } = performanceGeralMock

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Performance Geral</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">
            {clienteSelecionado}
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {CLIENTES.map((c) => (
              <DropdownMenuItem key={c}>{c}</DropdownMenuItem>
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
              <span
                className={cn(
                  'mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium',
                  m.tendencia.direcao === 'up' ? 'text-chart-success' : 'text-destructive',
                )}
              >
                <Seta direcao={m.tendencia.direcao} />
                {m.tendencia.valor}
              </span>
            </div>
          ))}
        </div>

        {/* Gráfico de linha azul */}
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <LineChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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

        {/* Mini-métricas de rodapé */}
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5">
          {miniMetricas.map((m) => (
            <div key={m.id}>
              <p className="text-[11px] text-muted-foreground">{m.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{m.valor}</p>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] font-medium',
                  m.tendencia.direcao === 'up' ? 'text-chart-success' : 'text-destructive',
                )}
              >
                <Seta direcao={m.tendencia.direcao} />
                {m.tendencia.valor}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
