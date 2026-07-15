'use client'

// Grade de KPIs configurável da página /campanhas (referência: dashboard Meta Ads).
// Somente visualização — nenhum controle aqui liga/desliga campanhas.

import { useMemo, useState, useTransition } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpDown,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Eye,
  Heart,
  Link2,
  MessageCircle,
  MousePointerClick,
  Receipt,
  Settings2,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CATALOGO_METRICAS,
  calcularMetricas,
  variacao,
  variacaoEBoa,
  type MetricaId,
  type FormatoMetrica,
  type TotaisPeriodo,
} from '@/lib/trafego/metricas'
import {
  salvarPreferenciasCampanhas,
  type PreferenciaKpi,
} from '@/actions/trafego'
import { OrganizarSheet } from './organizar-sheet'

const ICONE_POR_METRICA: Partial<Record<MetricaId, LucideIcon>> = {
  investimento: DollarSign,
  valorEmCompras: BadgeDollarSign,
  roas: TrendingUp,
  cpaMedio: Target,
  ticketMedio: Receipt,
  adicoesCarrinho: ShoppingCart,
  compras: CreditCard,
  conversas: MessageCircle,
  custoPorConversa: MessageCircle,
  leads: Users,
  custoPorLead: Target,
  impressoes: Eye,
  alcance: Eye,
  cliques: MousePointerClick,
  cliquesNoLink: Link2,
  ctrTodos: TrendingUp,
  ctrLink: TrendingUp,
  cpm: Target,
  cpcMedio: Target,
  cpcLink: Target,
  visualizacoesLp: Eye,
  engajamento: Heart,
  resultados: CheckCircle2,
  custoPorResultado: Target,
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorNumero = new Intl.NumberFormat('pt-BR')
const formatadorPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formata o valor do card. Métrica sem dados mostra o zero do formato — nunca some. */
function formatarValor(valor: number | null, formato: FormatoMetrica): string {
  const v = valor ?? 0
  switch (formato) {
    case 'moeda':
      return formatadorMoeda.format(v)
    case 'pct':
      return `${formatadorPct.format(v)}%`
    case 'multiplicador':
      return `${formatadorPct.format(v)}x`
    case 'numero':
    default:
      return formatadorNumero.format(v)
  }
}

/**
 * Resolve a ordem/visibilidade final: preferências salvas mandam; métricas novas
 * (fora da preferência salva) entram no fim, ligadas. Sem preferências, usa a
 * ordem padrão do catálogo com tudo ligado.
 */
export function resolverPreferencias(salvas: PreferenciaKpi[] | null): PreferenciaKpi[] {
  const idsValidos = new Set(CATALOGO_METRICAS.map((m) => m.id as string))
  const base = (salvas ?? []).filter((p) => idsValidos.has(p.id))
  const presentes = new Set(base.map((p) => p.id))
  for (const m of CATALOGO_METRICAS) {
    if (!presentes.has(m.id)) base.push({ id: m.id, ativo: true })
  }
  return base
}

type GradeKpisProps = {
  totaisAtual: TotaisPeriodo
  totaisAnterior: TotaisPeriodo
  preferencias: PreferenciaKpi[] | null
  clienteId: string
}

export function GradeKpis({ totaisAtual, totaisAnterior, preferencias, clienteId }: GradeKpisProps) {
  const [prefs, setPrefs] = useState<PreferenciaKpi[]>(() => resolverPreferencias(preferencias))
  const [comparando, setComparando] = useState(false)
  const [organizarAberto, setOrganizarAberto] = useState(false)
  const [, startTransition] = useTransition()

  const metricasAtual = useMemo(() => calcularMetricas(totaisAtual), [totaisAtual])
  const metricasAnterior = useMemo(() => calcularMetricas(totaisAnterior), [totaisAnterior])

  const catalogoPorId = useMemo(
    () => new Map(CATALOGO_METRICAS.map((m) => [m.id, m])),
    [],
  )

  // Estado otimista: atualiza a grade na hora e persiste em background.
  function aplicarPrefs(novas: PreferenciaKpi[]) {
    setPrefs(novas)
    startTransition(async () => {
      const res = await salvarPreferenciasCampanhas(clienteId, { kpis: novas })
      if (res?.error) toast.error(res.error)
    })
  }

  const ativas = prefs.filter((p) => p.ativo)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Visão geral</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrganizarAberto(true)}
          >
            <Settings2 className="size-4" />
            Organizar
          </Button>
          <Button
            variant={comparando ? 'default' : 'outline'}
            size="sm"
            onClick={() => setComparando((v) => !v)}
            aria-pressed={comparando}
          >
            <ArrowUpDown className="size-4" />
            Comparar
          </Button>
        </div>
      </div>

      {comparando && (
        <p className="text-xs text-muted-foreground">
          Variação vs. período anterior equivalente.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ativas.map((p) => {
          const meta = catalogoPorId.get(p.id as MetricaId)
          if (!meta) return null
          const Icone = ICONE_POR_METRICA[meta.id] ?? Target
          const valorAtual = metricasAtual[meta.id]
          const delta = variacao(valorAtual, metricasAnterior[meta.id])
          const boa = delta !== null ? variacaoEBoa(meta.id, delta) : null

          return (
            <Card
              key={p.id}
              className="gap-2 border-none p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-muted-foreground" title={meta.label}>
                  {meta.label}
                </span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                  <Icone className="size-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatarValor(valorAtual, meta.formato)}
                </span>
              </div>
              {comparando && (
                <div className="flex items-center gap-1 text-xs">
                  {delta === null ? (
                    <span className="text-muted-foreground">— sem base de comparação</span>
                  ) : (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 font-medium',
                        boa ? 'text-chart-success' : 'text-destructive',
                      )}
                    >
                      {delta >= 0 ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {formatadorPct.format(Math.abs(delta))}%
                      <span className="font-normal text-muted-foreground">vs. período anterior</span>
                    </span>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <OrganizarSheet
        aberto={organizarAberto}
        onAbertoChange={setOrganizarAberto}
        prefs={prefs}
        onPrefsChange={aplicarPrefs}
      />
    </div>
  )
}
