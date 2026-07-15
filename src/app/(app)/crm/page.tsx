import { AlertTriangle } from 'lucide-react'

import { getKanban } from '@/lib/crm/dados'
import { KanbanCrm } from '@/components/crm/kanban-crm'
import { NovaOportunidadeDialog } from '@/components/crm/nova-oportunidade-dialog'

// Backstop contra o timeout de 300s da Vercel (padrão das páginas do grupo app).
export const maxDuration = 60

// Kanban FUNCIONAL básico do pipeline padrão. O visual definitivo virá do
// mockup do usuário numa entrega futura — esta tela prioriza o fluxo real
// (criar, mover, ganhar/perder) sobre o acabamento.
export default async function CrmPage() {
  const kanban = await getKanban()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de vendas — oportunidades abertas.
          </p>
        </div>
        {kanban.configurado && <NovaOportunidadeDialog etapas={kanban.etapas} />}
      </div>

      {!kanban.configurado ? (
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
      ) : (
        <KanbanCrm colunas={kanban.colunas} etapas={kanban.etapas} />
      )}
    </div>
  )
}
