import { Suspense } from 'react'
import {
  Megaphone,
  MessageCircle,
  Users,
} from 'lucide-react'

import { KpiCard } from '@/components/dashboard/kpi-card'
import { KpisFinanceiros } from '@/components/dashboard/kpis-financeiros'
import { PerformanceGeral } from '@/components/dashboard/performance-geral'
import { CampanhasSaude } from '@/components/dashboard/campanhas-saude'
import { AgendaHoje } from '@/components/dashboard/agenda-hoje'
import { ResumoFinanceiro } from '@/components/dashboard/resumo-financeiro'
import { AlertasImportantes } from '@/components/dashboard/alertas-importantes'
import { AtividadeRecente } from '@/components/dashboard/atividade-recente'
import { PerformanceClienteTable } from '@/components/dashboard/performance-cliente-table'
import { AiInsightFloat } from '@/components/dashboard/ai-insight-float'
import { EvolucaoFinanceira } from '@/components/dashboard/evolucao-financeira'
import { FiltroPeriodo } from '@/components/dashboard/filtro-periodo'
import { getDashboardData, type TendenciaKpi } from '@/lib/dashboard/data'
import { getVisaoExecutiva } from '@/actions/financeiro'
import { getCurrentUser } from '@/lib/auth/session'
import type { Tendencia } from '@/lib/mock/dashboard-ref'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

const formatadorNumero = new Intl.NumberFormat('pt-BR')
const formatadorPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

// TendenciaKpi (dados) → Tendencia (exibição): "14,6%" com direção da seta.
function exibirTendencia(t: TendenciaKpi | null | undefined): Tendencia | undefined {
  if (!t) return undefined
  return { valor: `${formatadorPct.format(t.pct)}%`, direcao: t.direcao }
}

// Sparkline só quando a série tem algum dado real — série toda zerada é ruído.
function exibirSerie(serie: number[] | undefined): number[] | undefined {
  return serie && serie.some((v) => v !== 0) ? serie : undefined
}

type Props = {
  searchParams: Promise<{ periodo?: string }>
}

export default async function PainelPage({ searchParams }: Props) {
  const params = await searchParams
  let mesParam: number | undefined
  let anoParam: number | undefined

  if (params.periodo) {
    const [a, m] = params.periodo.split('-')
    anoParam = parseInt(a, 10)
    mesParam = parseInt(m, 10)
  }

  const [user, data] = await Promise.all([getCurrentUser(), getDashboardData(mesParam, anoParam)])

  // SEQUENCIAL depois do Promise.all (regra do pool max=5 — nunca engordar
  // os lotes): resumo executivo de churn/LTV (quick-260719-wwm). null =
  // migration 0038 pendente → os chips simplesmente não aparecem.
  const visaoExecutiva = await getVisaoExecutiva()
  const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  const primeiroNome = user?.nome?.split(' ')[0] ?? 'Usuário'

  // Horário de Brasília (UTC-3) para saudação correta
  const horaBrasilia = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  ).getHours()
  const saudacao =
    horaBrasilia >= 6 && horaBrasilia < 12
      ? 'Bom dia'
      : horaBrasilia >= 12 && horaBrasilia < 18
        ? 'Boa tarde'
        : 'Boa noite'

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {saudacao}, {primeiroNome}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o resumo completo da sua agência hoje.
          </p>
        </div>
        <Suspense fallback={null}>
          <FiltroPeriodo />
        </Suspense>
      </div>

      {/* Faixa de 6 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpisFinanceiros
          mrr={data?.kpis.mrr ?? 0}
          receitaMes={data?.kpis.receitaMes ?? 0}
          percentRecebido={data?.financeiro.percentRecebido ?? 0}
          lucroMes={data?.kpis.lucroMes ?? 0}
          tendencias={{
            mrr: exibirTendencia(data?.tendencias.mrr),
            receita: exibirTendencia(data?.tendencias.receita),
            lucro: exibirTendencia(data?.tendencias.lucro),
          }}
          series={{
            mrr: exibirSerie(data?.series.mrr),
            lucro: exibirSerie(data?.series.lucro),
          }}
        />
        <KpiCard
          label="Clientes Ativos"
          valor={formatadorNumero.format(data?.kpis.clientesAtivos ?? 0)}
          icon={Users}
          cor="info"
          tendencia={
            data && data.novosClientesMes > 0
              ? { valor: `${data.novosClientesMes} este mês`, direcao: 'up' }
              : undefined
          }
        />
        <KpiCard
          label="Campanhas Ativas"
          valor={formatadorNumero.format(data?.kpis.campanhasAtivas ?? 0)}
          icon={Megaphone}
          cor="orange"
          helper={
            data && data.clientesComCampanhas > 0
              ? `Em ${data.clientesComCampanhas} cliente${data.clientesComCampanhas > 1 ? 's' : ''}`
              : undefined
          }
        />
        <KpiCard
          label="Conversas (7d)"
          valor={formatadorNumero.format(data?.kpis.conversasTotais ?? 0)}
          icon={MessageCircle}
          cor="whatsapp"
          helper="últimos 7 dias"
        />
      </div>

      {/* Chips executivos — churn e LTV (visão completa no Financeiro → Visão Analítica) */}
      {visaoExecutiva && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            Churn do mês:{' '}
            {visaoExecutiva.churnMes.percentual === null
              ? '—'
              : `${visaoExecutiva.churnMes.percentual}%`}
            {visaoExecutiva.churn3m.percentual !== null &&
              ` · 3m ${visaoExecutiva.churn3m.percentual}%`}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            LTV médio:{' '}
            {visaoExecutiva.ltv ? formatadorMoeda.format(visaoExecutiva.ltv.valor) : '—'}
          </span>
        </div>
      )}

      {/* Linha do meio — Performance mais larga, Saúde e Agenda ao lado */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 md:col-span-2">
          <PerformanceGeral clientes={data?.clientesPerformance ?? []} />
        </div>
        <CampanhasSaude clientes={data?.clientesPerformance ?? []} />
        <Suspense
          fallback={
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-sm)]">
              <p className="text-base font-semibold">Agenda de Hoje</p>
              <p className="mt-6 text-center text-sm text-muted-foreground">Carregando...</p>
            </div>
          }
        >
          <AgendaHoje />
        </Suspense>
      </div>

      {/* Linha de baixo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ResumoFinanceiro dados={data?.financeiro ?? null} />
        <AlertasImportantes />
        <AtividadeRecente atividades={data?.atividadeRecente ?? []} />
      </div>

      {/* Gráfico de evolução financeira — acima da tabela de performance */}
      <EvolucaoFinanceira dados={data?.evolucaoMensal ?? []} />

      {/* Tabela full width — scroll horizontal em mobile */}
      <div className="min-w-0">
        <PerformanceClienteTable clientes={data?.clientesPerformance ?? []} />
      </div>

      {/* Card flutuante de IA (fora do fluxo) */}
      <AiInsightFloat />
    </div>
  )
}
