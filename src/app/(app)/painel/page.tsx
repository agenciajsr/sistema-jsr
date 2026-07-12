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
import { getDashboardData } from '@/lib/dashboard/data'
import { getCurrentUser } from '@/lib/auth/session'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')

export default async function PainelPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getDashboardData()])

  const primeiroNome = user?.nome?.split(' ')[0] ?? 'Usuário'

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bom dia, {primeiroNome}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o resumo completo da sua agência hoje.
          </p>
        </div>
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

      {/* Linha do meio — Performance mais larga, Saúde e Agenda ao lado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="lg:col-span-2">
          <PerformanceGeral clientes={data?.clientesPerformance ?? []} />
        </div>
        <CampanhasSaude clientes={data?.clientesPerformance ?? []} />
        <AgendaHoje />
      </div>

      {/* Linha de baixo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ResumoFinanceiro dados={data?.financeiro ?? null} />
        <AlertasImportantes />
        <AtividadeRecente atividades={data?.atividadeRecente ?? []} />
      </div>

      {/* Tabela full width */}
      <PerformanceClienteTable clientes={data?.clientesPerformance ?? []} />

      {/* Card flutuante de IA (fora do fluxo) */}
      <AiInsightFloat />
    </div>
  )
}
