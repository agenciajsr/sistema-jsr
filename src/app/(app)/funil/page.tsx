import { AlertTriangle } from 'lucide-react'

import { getDashboardComercial, presetValido } from '@/lib/crm/dados-funil'
import { FunilView } from '@/components/funil/funil-view'

// Backstop contra o timeout de 300s da Vercel (padrão das páginas do grupo app).
export const maxDuration = 60

// Dashboard Comercial: visão estratégica do funil de vendas sobre os dados
// reais do CRM. Filtros de período/pipeline vêm pela URL — o server refaz as
// queries agregadas a cada navegação.
export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; periodo?: string }>
}) {
  const { pipeline, periodo } = await searchParams
  const dados = await getDashboardComercial(pipeline, presetValido(periodo))

  // Degradação graciosa: sem workspace/pipeline (migration 0019 não aplicada).
  if (!dados.configurado) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground">Visão estratégica do funil de vendas</p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">CRM ainda não ativado</p>
            <p className="text-muted-foreground">
              Aplique a migration 0019 para ativar o CRM (cria o workspace JSR, o pipeline
              Vendas e as 6 etapas padrão).
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <FunilView dados={dados} />
}
