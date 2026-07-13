import { Suspense } from 'react'
import {
  HandCoins,
  Megaphone,
  MessageCircle,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import { KpiCard } from '@/components/dashboard/kpi-card'
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
import { getDashboardData } from '@/lib/dashboard/data'
import { getCurrentUser } from '@/lib/auth/session'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')

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
        <KpiCard
          label="Faturamento (MRR)"
          valor={formatadorMoeda.format(data?.kpis.mrr ?? 0)}
          icon={Wallet}
          cor="info"
        />
        <KpiCard
          label="Recebimentos (Mês)"
          valor={formatadorMoeda.format(data?.kpis.receitaMes ?? 0)}
          icon={HandCoins}
          cor="success"
          helper={data ? `${data.financeiro.percentRecebido}% do MRR` : undefined}
          progresso={data?.financeiro.percentRecebido}
        />
        <KpiCard
          label="Lucro Líquido (Mês)"
          valor={formatadorMoeda.format(data?.kpis.lucroMes ?? 0)}
          icon={TrendingUp}
          cor="purple"
        />
        <KpiCard
          label="Clientes Ativos"
          valor={formatadorNumero.format(data?.kpis.clientesAtivos ?? 0)}
          icon={Users}
          cor="info"
        />
        <KpiCard
          label="Campanhas Ativas"
          valor={formatadorNumero.format(data?.kpis.campanhasAtivas ?? 0)}
          icon={Megaphone}
          cor="orange"
        />
        <KpiCard
          label="Conversas (7d)"
          valor={formatadorNumero.format(data?.kpis.conversasTotais ?? 0)}
          icon={MessageCircle}
          cor="whatsapp"
        />
      </div>

      {/* Gráfico de evolução financeira */}
      <EvolucaoFinanceira dados={data?.evolucaoMensal ?? []} />

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

      {/* Tabela full width — scroll horizontal em mobile */}
      <div className="min-w-0">
        <PerformanceClienteTable clientes={data?.clientesPerformance ?? []} />
      </div>

      {/* Card flutuante de IA (fora do fluxo) */}
      <AiInsightFloat />
    </div>
  )
}
