'use client'

// Card "Dados Demográficos" (referência: imagem 6): barras EMPILHADAS por
// gênero em cada faixa etária, seletor de campanha, pílulas de métrica
// (Impressões/Resultados/Compras/Leads/Conversas) e botão "Ocultar Gênero".
// Somente visualização — dados refletem a janela ~30d do sync.

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { LinhaDemografia } from '@/lib/trafego/painel'

const formatadorNumero = new Intl.NumberFormat('pt-BR')

// Ordem canônica das faixas etárias da Meta.
const FAIXAS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const

type MetricaDemo = 'impressions' | 'resultados' | 'compras' | 'leads' | 'conversas'

const METRICAS: { id: MetricaDemo; label: string }[] = [
  { id: 'impressions', label: 'Impressões' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'compras', label: 'Compras' },
  { id: 'leads', label: 'Leads' },
  { id: 'conversas', label: 'Conversas' },
]

const GENEROS = [
  { id: 'masculino', label: 'Masculino', cor: 'var(--chart-1)', matcher: (g: string) => g === 'male' },
  { id: 'feminino', label: 'Feminino', cor: 'var(--chart-2)', matcher: (g: string) => g === 'female' },
  { id: 'desconhecido', label: 'Desconhecido', cor: 'var(--muted-foreground)', matcher: () => true },
] as const

function generoDe(gender: string): 'masculino' | 'feminino' | 'desconhecido' {
  if (gender === 'male') return 'masculino'
  if (gender === 'female') return 'feminino'
  return 'desconhecido'
}

type LinhaGrafico = {
  faixa: string
  masculino: number
  feminino: number
  desconhecido: number
  total: number
}

type DemografiaSectionProps = {
  demografia: LinhaDemografia[]
}

export function DemografiaSection({ demografia }: DemografiaSectionProps) {
  const [metrica, setMetrica] = useState<MetricaDemo>('resultados')
  const [ocultarGenero, setOcultarGenero] = useState(false)

  const campanhas = useMemo(() => {
    const map = new Map<string, { nome: string; spend: number }>()
    for (const l of demografia) {
      const atual = map.get(l.campaignId)
      if (atual) atual.spend += l.spend
      else map.set(l.campaignId, { nome: l.campaignName, spend: l.spend })
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, nome: v.nome, spend: v.spend }))
      .sort((a, b) => b.spend - a.spend)
  }, [demografia])

  const [campanhaId, setCampanhaId] = useState<string>('todas')

  const nomeCampanha =
    campanhaId === 'todas'
      ? 'Todas as campanhas'
      : campanhas.find((c) => c.id === campanhaId)?.nome ?? ''

  const dados: LinhaGrafico[] = useMemo(() => {
    const porFaixa = new Map<string, LinhaGrafico>()
    for (const f of FAIXAS) {
      porFaixa.set(f, { faixa: f, masculino: 0, feminino: 0, desconhecido: 0, total: 0 })
    }
    for (const l of demografia) {
      if (campanhaId !== 'todas' && l.campaignId !== campanhaId) continue
      // Faixas fora do padrão ('Unknown' etc.) somam em Desconhecido? Não —
      // fora das 7 faixas canônicas o dado é ignorado no eixo X (raro).
      const linha = porFaixa.get(l.age)
      if (!linha) continue
      const valor = l[metrica === 'impressions' ? 'impressions' : metrica]
      linha[generoDe(l.gender)] += valor
      linha.total += valor
    }
    return Array.from(porFaixa.values())
  }, [demografia, campanhaId, metrica])

  const temDado = dados.some((d) => d.total > 0)
  const labelMetrica = METRICAS.find((m) => m.id === metrica)?.label ?? ''

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {}
    for (const g of GENEROS) cfg[g.id] = { label: g.label, color: g.cor }
    cfg.total = { label: labelMetrica, color: 'var(--chart-1)' }
    return cfg
  }, [labelMetrica])

  if (demografia.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Dados Demográficos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados demográficos ainda — rode uma sincronização.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Dados Demográficos{nomeCampanha ? ` — ${nomeCampanha}` : ''}
          </CardTitle>
          {campanhas.length > 1 && (
            <Select value={campanhaId} onValueChange={setCampanhaId}>
              <SelectTrigger className="w-[260px]" size="sm">
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
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {METRICAS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetrica(m.id)}
              aria-pressed={metrica === m.id}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                metrica === m.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
          <Button
            type="button"
            variant={ocultarGenero ? 'default' : 'outline'}
            size="sm"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => setOcultarGenero((v) => !v)}
            aria-pressed={ocultarGenero}
          >
            Ocultar Gênero
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!temDado ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem {labelMetrica.toLowerCase()} nesta seleção.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="faixa" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                fontSize={11}
                tickFormatter={(v: number) => formatadorNumero.format(v)}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const linha = payload[0]?.payload as LinhaGrafico | undefined
                  if (!linha) return null
                  return (
                    <div className="rounded-lg border bg-background p-3 text-xs shadow-md">
                      <p className="font-semibold">Idade: {linha.faixa}</p>
                      <p className="mt-1 text-muted-foreground">
                        Total {labelMetrica.toLowerCase()}: {formatadorNumero.format(linha.total)}
                      </p>
                      {!ocultarGenero && linha.total > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-muted-foreground">Distribuição por gênero:</p>
                          {GENEROS.map((g) => {
                            const valor = linha[g.id]
                            if (valor <= 0) return null
                            const pct = Math.round((valor / linha.total) * 100)
                            return (
                              <p key={g.id} className="flex items-center gap-1.5">
                                <span
                                  className="inline-block size-2 rounded-full"
                                  style={{ backgroundColor: g.cor }}
                                />
                                {g.label}: {pct}% ({formatadorNumero.format(valor)})
                              </p>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              {ocultarGenero ? (
                <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={72} />
              ) : (
                GENEROS.map((g, idx) => (
                  <Bar
                    key={g.id}
                    dataKey={g.id}
                    stackId="genero"
                    fill={g.cor}
                    radius={idx === GENEROS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    maxBarSize={72}
                  />
                ))
              )}
            </BarChart>
          </ChartContainer>
        )}

        {/* Legenda embaixo (como na referência) */}
        {!ocultarGenero && temDado && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {GENEROS.map((g) => (
              <span key={g.id} className="flex items-center gap-1.5 text-xs font-medium">
                <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: g.cor }} />
                {g.label}
              </span>
            ))}
          </div>
        )}
        <p className="rounded-md bg-muted/50 py-1.5 text-center text-xs text-muted-foreground">
          Dados demográficos refletem os últimos ~30 dias da sincronização com o Meta
          (mesma janela dos anúncios), independente do período selecionado.
        </p>
      </CardContent>
    </Card>
  )
}
