'use client'

// Card "Performance" (referência: imagem 3): gráfico de linhas diário
// multi-métrica com legenda clicável e filtro por campanha, eixos duplos
// (moeda à esquerda, contagem à direita). Somente visualização.

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { MetricaId } from '@/lib/trafego/metricas'
import type { PontoSerie } from '@/lib/trafego/painel'
import type { ChaveHeroi } from '@/lib/trafego/aggregate'

// Métricas disponíveis na legenda (subset do catálogo que faz sentido diário).
type MetricaGrafico = {
  id: MetricaId
  label: string
  moeda: boolean // true = eixo esquerdo (R$); false = eixo direito (contagem)
  cor: string
  calc: (p: AgregadoDia) => number | null
}

type AgregadoDia = {
  date: string
  spend: number
  reach: number
  leads: number
  vendas: number
  conversas: number
  clicks: number
}

const METRICAS_GRAFICO: MetricaGrafico[] = [
  { id: 'investimento', label: 'Investimento', moeda: true, cor: 'var(--chart-1)', calc: (p) => p.spend },
  { id: 'alcance', label: 'Alcance', moeda: false, cor: 'var(--chart-2)', calc: (p) => p.reach },
  { id: 'leads', label: 'Leads', moeda: false, cor: 'var(--chart-3)', calc: (p) => p.leads },
  { id: 'custoPorLead', label: 'Custo por Lead', moeda: true, cor: 'var(--chart-4)', calc: (p) => (p.leads > 0 ? p.spend / p.leads : null) },
  { id: 'compras', label: 'Compras', moeda: false, cor: 'var(--chart-5)', calc: (p) => p.vendas },
  { id: 'conversas', label: 'Conversas', moeda: false, cor: 'var(--chart-2)', calc: (p) => p.conversas },
  { id: 'cliques', label: 'Cliques', moeda: false, cor: 'var(--chart-3)', calc: (p) => p.clicks },
  { id: 'custoPorConversa', label: 'Custo por Conversa', moeda: true, cor: 'var(--chart-5)', calc: (p) => (p.conversas > 0 ? p.spend / p.conversas : null) },
]

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorNumero = new Intl.NumberFormat('pt-BR')

function rotuloDia(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type GraficoPerformanceProps = {
  serie: PontoSerie[]
  heroiChave: ChaveHeroi
}

export function GraficoPerformance({ serie, heroiChave }: GraficoPerformanceProps) {
  // Default ligadas: investimento + métrica-herói do cliente.
  const idHeroi: MetricaId =
    heroiChave === 'vendas' ? 'compras' : heroiChave === 'conversas' ? 'conversas' : 'leads'
  const [ativas, setAtivas] = useState<Set<MetricaId>>(new Set(['investimento', idHeroi]))
  const [campanhaId, setCampanhaId] = useState<string>('todas')

  const campanhas = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of serie) map.set(p.campaignId, p.campaignName)
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }))
  }, [serie])

  // Agrega a série por dia, respeitando o filtro de campanha (client-side).
  const dados = useMemo(() => {
    const porDia = new Map<string, AgregadoDia>()
    for (const p of serie) {
      if (campanhaId !== 'todas' && p.campaignId !== campanhaId) continue
      const dia = porDia.get(p.date) ?? {
        date: p.date,
        spend: 0,
        reach: 0,
        leads: 0,
        vendas: 0,
        conversas: 0,
        clicks: 0,
      }
      dia.spend += p.spend
      dia.reach += p.reach
      dia.leads += p.leads
      dia.vendas += p.vendas
      dia.conversas += p.conversas
      dia.clicks += p.clicks
      porDia.set(p.date, dia)
    }
    return Array.from(porDia.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const linha: Record<string, string | number | null> = { rotulo: rotuloDia(d.date) }
        for (const m of METRICAS_GRAFICO) linha[m.id] = m.calc(d)
        return linha
      })
  }, [serie, campanhaId])

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {}
    for (const m of METRICAS_GRAFICO) cfg[m.id] = { label: m.label, color: m.cor }
    return cfg
  }, [])

  function alternarMetrica(id: MetricaId) {
    setAtivas((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) {
        if (novo.size === 1) return novo // manter pelo menos 1 métrica ligada
        novo.delete(id)
      } else {
        novo.add(id)
      }
      return novo
    })
  }

  const temMoeda = METRICAS_GRAFICO.some((m) => ativas.has(m.id) && m.moeda)
  const temContagem = METRICAS_GRAFICO.some((m) => ativas.has(m.id) && !m.moeda)

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Performance</CardTitle>
        {campanhas.length > 1 && (
          <Select value={campanhaId} onValueChange={setCampanhaId}>
            <SelectTrigger className="w-[240px]" size="sm">
              <SelectValue placeholder="Todas as campanhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as campanhas</SelectItem>
              {campanhas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {dados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem série diária no período.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              {temMoeda && (
                <YAxis
                  yAxisId="moeda"
                  orientation="left"
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  fontSize={11}
                  tickFormatter={(v: number) => formatadorMoeda.format(v)}
                />
              )}
              {temContagem && (
                <YAxis
                  yAxisId="contagem"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  fontSize={11}
                  tickFormatter={(v: number) => formatadorNumero.format(v)}
                />
              )}
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      const meta = METRICAS_GRAFICO.find((m) => m.id === name)
                      const v = Number(value)
                      return `${meta?.label ?? name}: ${meta?.moeda ? formatadorMoeda.format(v) : formatadorNumero.format(v)}`
                    }}
                  />
                }
              />
              {METRICAS_GRAFICO.filter((m) => ativas.has(m.id)).map((m) => (
                <Line
                  key={m.id}
                  yAxisId={m.moeda ? 'moeda' : 'contagem'}
                  type="monotone"
                  dataKey={m.id}
                  stroke={m.cor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}

        {/* Legenda clicável (como na referência) */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {METRICAS_GRAFICO.map((m) => {
            const ligada = ativas.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => alternarMetrica(m.id)}
                className={cn(
                  'text-xs font-medium transition-colors',
                  ligada ? '' : 'text-muted-foreground line-through opacity-60',
                )}
                style={ligada ? { color: m.cor } : undefined}
                aria-pressed={ligada}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <p className="rounded-md bg-muted/50 py-1.5 text-center text-xs text-muted-foreground">
          Clique nas métricas acima para alterar a visualização
        </p>
      </CardContent>
    </Card>
  )
}
