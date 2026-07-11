'use client'

import { AlertTriangle, CalendarClock, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

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
  alertasMock,
  clientesTrafegoMock,
  financeiroMock,
  verbaDiariaMock,
} from '@/lib/mock/dashboard'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const chartConfig = {
  verba: {
    label: 'Verba',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

const CORES_STATUS_CONTA: Record<'ativa' | 'atencao' | 'problema', string> = {
  ativa: 'bg-chart-success',
  atencao: 'bg-chart-warning',
  problema: 'bg-chart-danger',
}

export default function PainelPage() {
  const mrrTotal = financeiroMock.reduce((acc, c) => acc + c.mrr, 0)
  const aReceber7Dias = financeiroMock
    .filter((c) => c.status === 'próximo')
    .reduce((acc, c) => acc + c.mrr, 0)
  const verbaRodando = clientesTrafegoMock.reduce((acc, c) => acc + c.verbaTotal, 0)
  const contasComProblema = clientesTrafegoMock.filter(
    (c) => c.contaStatus === 'problema',
  ).length

  const clientesAtivos = clientesTrafegoMock.length
  const pontosDeAtencao = alertasMock.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bom dia, JSR 👋</h1>
        <p className="text-sm text-muted-foreground">
          {clientesAtivos} clientes ativos · {pontosDeAtencao} pontos precisam de você hoje
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. Os números reais de verba, campanhas e
        performance passam a aparecer aqui quando a integração com Meta Ads
        (Fase 2) e o painel de tráfego (Fase 3) forem implementados.
      </MockNotice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR Total"
          value={formatadorMoeda.format(mrrTotal)}
          icon={Wallet}
          color="success"
          trend={{ value: '8,2%', direction: 'up' }}
          helper="soma dos contratos ativos"
        />
        <StatCard
          label="A receber (7 dias)"
          value={formatadorMoeda.format(aReceber7Dias)}
          icon={CalendarClock}
          color="primary"
          helper="próximos vencimentos"
        />
        <StatCard
          label="Verba rodando"
          value={formatadorMoeda.format(verbaRodando)}
          icon={TrendingUp}
          color="warning"
          helper="somando as contas de ads"
        />
        <StatCard
          label="Contas com problema"
          value={String(contasComProblema)}
          icon={AlertTriangle}
          color="danger"
          helper="precisam de atenção imediata"
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">🚩 Precisa de você hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertasMock.map((alerta) => {
            const critico = alerta.severidade === 'critico'
            return (
              <div
                key={alerta.id}
                className={`flex items-start justify-between gap-3 rounded-lg border-l-4 p-3 ${
                  critico
                    ? 'border-chart-danger bg-alert-danger-soft'
                    : 'border-chart-warning bg-alert-warning-soft'
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{alerta.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {alerta.cliente} · {alerta.detalhe}
                  </p>
                </div>
                {critico ? (
                  <Badge variant="destructive">Crítico</Badge>
                ) : (
                  <Badge className="bg-chart-warning/15 text-chart-warning" variant="secondary">
                    Atenção
                  </Badge>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">📊 Saúde das contas de anúncio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientesTrafegoMock.map((cliente) => (
              <div
                key={cliente.id}
                className="flex items-center gap-3 rounded-lg border bg-background p-3"
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ${
                    CORES_STATUS_CONTA[cliente.contaStatus]
                  }`}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {cliente.contas} {cliente.contas === 1 ? 'conta' : 'contas'} ·{' '}
                    {formatadorMoeda.format(cliente.verbaGasta)} de{' '}
                    {formatadorMoeda.format(cliente.verbaTotal)} · sync {cliente.ultimaSync}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">📈 Verba dos últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={verbaDiariaMock}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="valor" fill="var(--color-verba)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
