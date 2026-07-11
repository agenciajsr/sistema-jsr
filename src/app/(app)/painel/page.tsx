'use client'

import {
  CalendarDays,
  ChevronDown,
  HandCoins,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MockNotice } from '@/components/mock-notice'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { PerformanceGeral } from '@/components/dashboard/performance-geral'
import { CampanhasSaude } from '@/components/dashboard/campanhas-saude'
import { AgendaHoje } from '@/components/dashboard/agenda-hoje'
import { ResumoFinanceiro } from '@/components/dashboard/resumo-financeiro'
import { AlertasImportantes } from '@/components/dashboard/alertas-importantes'
import { AtividadeRecente } from '@/components/dashboard/atividade-recente'
import { PerformanceClienteTable } from '@/components/dashboard/performance-cliente-table'
import { AiInsightFloat } from '@/components/dashboard/ai-insight-float'
import { kpisMock } from '@/lib/mock/dashboard-ref'

// Ícone por KPI (mesma ordem/ids do mock).
const ICONE_KPI: Record<string, React.ComponentType<{ className?: string }>> = {
  faturamento: Wallet,
  recebimentos: HandCoins,
  lucro: TrendingUp,
  clientes: Users,
  campanhas: Megaphone,
  conversas: MessageCircle,
}

const CLIENTES = ['Todos os clientes', 'Clínica Bella', 'Pizzaria do João', 'Academia Evolution']
const PERIODOS = [
  'Últimos 7 dias (03/07 - 09/07)',
  'Últimos 30 dias',
  'Este mês',
  'Mês passado',
]

export default function PainelPage() {
  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bom dia, Jacson! 👋</h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o resumo completo da sua agência hoje.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">
              <LayoutGrid className="size-4 text-muted-foreground" />
              Todos os clientes
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CLIENTES.map((c) => (
                <DropdownMenuItem key={c}>{c}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">
              <CalendarDays className="size-4 text-muted-foreground" />
              Últimos 7 dias (03/07 - 09/07)
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PERIODOS.map((p) => (
                <DropdownMenuItem key={p}>{p}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. Os números reais de faturamento, campanhas
        e conversas passam a aparecer aqui quando a integração com Meta/Google Ads
        (Fase 2) e o financeiro forem conectados.
      </MockNotice>

      {/* Faixa de 6 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpisMock.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            valor={kpi.valor}
            icon={ICONE_KPI[kpi.id] ?? Wallet}
            cor={kpi.cor}
            tendencia={kpi.tendencia}
            helper={kpi.helper}
            serie={kpi.serie}
            progresso={kpi.progresso}
          />
        ))}
      </div>

      {/* Linha do meio — Performance mais larga, Saúde e Agenda ao lado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="lg:col-span-2">
          <PerformanceGeral />
        </div>
        <CampanhasSaude />
        <AgendaHoje />
      </div>

      {/* Linha de baixo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ResumoFinanceiro />
        <AlertasImportantes />
        <AtividadeRecente />
      </div>

      {/* Tabela full width */}
      <PerformanceClienteTable />

      {/* Card flutuante de IA (fora do fluxo) */}
      <AiInsightFloat />
    </div>
  )
}
