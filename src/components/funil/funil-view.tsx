'use client'

import { useRouter } from 'next/navigation'
import { TrendingDown, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FunilVisual } from '@/components/funil/funil-visual'
import { corOrigem, nomeOrigem } from '@/lib/crm/origem'
import type { DashboardComercial } from '@/lib/crm/dados-funil'
import type { KpiComVariacao, PresetPeriodo } from '@/lib/crm/funil-comercial'

const ROTULOS_PERIODO: Record<PresetPeriodo, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  'este-mes': 'Este mês',
  'mes-passado': 'Mês passado',
  'ultimos-30': 'Últimos 30 dias',
  'este-ano': 'Este ano',
}

const REAL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatarVariacao(v: number): string {
  return `${(Math.round(Math.abs(v) * 10) / 10).toLocaleString('pt-BR')}%`
}

// Variação colorida dos cards/linhas: verde quando melhora, vermelho quando
// piora ("inverter" = subir é ruim, caso de Leads Perdidos), "— 0%" neutro.
function Variacao({ variacao, inverter = false }: { variacao: number | null; inverter?: boolean }) {
  if (variacao === null || variacao === 0) {
    return <span className="text-xs text-muted-foreground">— 0%</span>
  }
  const subiu = variacao > 0
  const bom = inverter ? !subiu : subiu
  const Icone = subiu ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      <Icone className="size-3" />
      {subiu ? '+' : '-'}
      {formatarVariacao(variacao)}
    </span>
  )
}

function KpiCard({
  titulo,
  kpi,
  moeda = false,
  inverter = false,
}: {
  titulo: string
  kpi: KpiComVariacao
  moeda?: boolean
  inverter?: boolean
}) {
  return (
    <Card className="bg-card">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">
          {moeda ? REAL.format(kpi.valor) : kpi.valor.toLocaleString('pt-BR')}
        </p>
        <div className="mt-1">
          <Variacao variacao={kpi.variacao} inverter={inverter} />
        </div>
      </CardContent>
    </Card>
  )
}

export function FunilView({ dados }: { dados: DashboardComercial }) {
  const router = useRouter()

  function navegar(periodo: string, pipeline: string | null) {
    const params = new URLSearchParams()
    params.set('periodo', periodo)
    if (pipeline) params.set('pipeline', pipeline)
    router.push(`/funil?${params.toString()}`)
  }

  const totalOrigens = dados.origens.reduce((soma, o) => soma + o.total, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground">Visão estratégica do funil de vendas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dados.periodo} onValueChange={(v) => navegar(v, dados.pipelineId)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROTULOS_PERIODO) as PresetPeriodo[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {ROTULOS_PERIODO[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dados.pipelines.length > 1 && (
            <Select
              value={dados.pipelineId ?? undefined}
              onValueChange={(v) => navegar(dados.periodo, v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dados.pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.nome}
                      {p.padrao && (
                        <Badge variant="secondary" className="text-[10px]">
                          Padrão
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Faixa de KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard titulo="Novo lead" kpi={dados.kpis.novosLeads} />
        <KpiCard titulo="Agendado" kpi={dados.kpis.agendados} />
        <KpiCard titulo="Vendas" kpi={dados.kpis.vendas} />
        <KpiCard titulo="Receita Total" kpi={dados.kpis.receitaTotal} moeda />
        <KpiCard titulo="Leads Perdidos" kpi={dados.kpis.leadsPerdidos} inverter />
      </div>

      {/* Funil + coluna lateral */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FunilVisual funil={dados.funil} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between">
                <span className="text-sm text-muted-foreground">Conversão Total</span>
                <div className="text-right">
                  <p className="font-bold tabular-nums">
                    {(Math.round(dados.performance.conversaoTotal.valor * 10) / 10).toLocaleString('pt-BR')}
                    %
                  </p>
                  <Variacao variacao={dados.performance.conversaoTotal.variacao} />
                </div>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-muted-foreground">Ticket Médio</span>
                <div className="text-right">
                  <p className="font-bold tabular-nums">
                    {REAL.format(dados.performance.ticketMedio.valor)}
                  </p>
                  <Variacao variacao={dados.performance.ticketMedio.variacao} />
                </div>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-muted-foreground">Receita/Lead</span>
                <div className="text-right">
                  <p className="font-bold tabular-nums">
                    {REAL.format(dados.performance.receitaPorLead.valor)}
                  </p>
                  <Variacao variacao={dados.performance.receitaPorLead.variacao} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Origem dos leads</CardTitle>
              {totalOrigens > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {totalOrigens} total
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {dados.origens.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem leads no período</p>
              )}
              {dados.origens.map((o) => (
                <div key={o.origem}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${corOrigem(o.origem)}`} />
                      {nomeOrigem(o.origem)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {o.total} ({o.pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${corOrigem(o.origem)}`}
                      style={{ width: `${o.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
