'use client'

import { Calendar, TrendingUp, Users, Wallet } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { MockNotice } from '@/components/mock-notice'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { financeiroMock, mrrHistoricoMock } from '@/lib/mock/dashboard'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const chartConfig = {
  mrr: {
    label: 'MRR',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

export default function FinanceiroPage() {
  const mrrTotal = financeiroMock.reduce((acc, c) => acc + c.mrr, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          MRR, datas de cobrança e saúde financeira consolidada.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. Alertas de vencimento de contrato e
        cálculo automático de MRR a partir dos contratos reais entram na Fase 4
        do roadmap.
      </MockNotice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="MRR Total"
          value={formatadorMoeda.format(mrrTotal)}
          icon={Wallet}
          color="success"
          trend={{ value: '4,5%', direction: 'up' }}
        />
        <StatCard
          label="Clientes Ativos"
          value={String(financeiroMock.length)}
          icon={Users}
          color="primary"
        />
        <StatCard
          label="Cobranças Próximas (7 dias)"
          value={String(financeiroMock.filter((c) => c.status === 'próximo').length)}
          icon={Calendar}
          color="warning"
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Evolução do MRR</CardTitle>
          <span className="flex items-center gap-1 text-xs font-medium text-chart-success">
            <TrendingUp className="size-3" />
            +36,5% em 6 meses
          </span>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={mrrHistoricoMock}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="mrr"
                type="monotone"
                fill="var(--color-mrr)"
                fillOpacity={0.15}
                stroke="var(--color-mrr)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Clientes e Cobrança</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Dia de Cobrança</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financeiroMock.map((c) => (
                <TableRow key={c.cliente}>
                  <TableCell className="font-medium">{c.cliente}</TableCell>
                  <TableCell>Dia {c.diaCobranca}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'em dia' ? 'secondary' : 'outline'}>
                      {c.status === 'em dia' ? 'Em dia' : 'Próximo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatadorMoeda.format(c.mrr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
