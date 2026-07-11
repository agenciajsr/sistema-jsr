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
import { AiInsightCard } from '@/components/premium/ai-insight-card'
import { ScoreRing } from '@/components/premium/score-ring'
import {
  agencyHealthMock,
  alertasMock,
  clientesTrafegoMock,
  financeiroMock,
  insightsIaMock,
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

// Seletor de período — placeholder visual (sem lógica) até os filtros globais
// serem conectados aos dados reais.
const PERIODOS = ['Hoje', '7 dias', '30 dias'] as const

export default function PainelPage() {
  const mrrTotal = financeiroMock.reduce((acc, c) => acc + c.mrr, 0)
  const aReceber7Dias = financeiroMock
    .filter((c) => c.status === 'próximo')
    .reduce((acc, c) => acc + c.mrr, 0)
  const verbaRodando = clientesTrafegoMock.reduce((acc, c) => acc + c.verbaTotal, 0)
  const contasComProblema = clientesTrafegoMock.filter(
    (c) => c.contaStatus === 'problema',
  ).length

  const clientesAtivos = agencyHealthMock.clientesAtivos
  const clientesEmRisco = agencyHealthMock.clientesEmRisco
  const pontosDeAtencao = alertasMock.length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bom dia, JSR 👋</h1>
          <p className="text-sm text-muted-foreground">
            {clientesAtivos} clientes ativos · {pontosDeAtencao} pontos precisam de você hoje
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 shadow-[var(--shadow-xs)]">
          {PERIODOS.map((periodo, i) => (
            <button
              key={periodo}
              type="button"
              className={
                i === 1
                  ? 'rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {periodo}
            </button>
          ))}
        </div>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. Os números reais de verba, campanhas e
        performance passam a aparecer aqui quando a integração com Meta Ads
        (Fase 2) e o painel de tráfego (Fase 3) forem implementados.
      </MockNotice>

      {/* HERO — Saúde da Agência (peça-assinatura Mission Control) */}
      <Card className="bg-[image:var(--gradient-surface)]">
        <CardContent className="flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
          <ScoreRing
            score={agencyHealthMock.score}
            size={168}
            label="Saúde da Agência"
            className="shrink-0"
          />
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Receita do mês (MRR)</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatadorMoeda.format(mrrTotal)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                soma dos contratos ativos
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes ativos</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {clientesAtivos}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                com contrato vigente
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes em risco</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-chart-danger">
                {clientesEmRisco}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                precisam de atenção
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights da IA (IA como protagonista) */}
      <AiInsightCard insights={insightsIaMock} />

      {/* Faixa de KPIs */}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🚩 Precisa de você hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertasMock.map((alerta) => {
            const critico = alerta.severidade === 'critico'
            return (
              <div
                key={alerta.id}
                className={`flex items-start justify-between gap-3 rounded-xl border-l-4 p-4 ${
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Saúde das contas de anúncio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientesTrafegoMock.map((cliente) => (
              <div
                key={cliente.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
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

        <Card>
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
