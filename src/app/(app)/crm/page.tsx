import { AlertTriangle } from 'lucide-react'

import { getCrmVisaoGeral } from '@/lib/crm/dados'
import { CrmView } from '@/components/crm/crm-view'

// Backstop contra o timeout de 300s da Vercel (padrão das páginas do grupo app).
export const maxDuration = 60

// Página do CRM no formato do mockup: os dados (kanban + KPIs + origens) vêm
// todos de getCrmVisaoGeral no server; o CrmView cuida do header/abas/busca.
export default async function CrmPage() {
  const dados = await getCrmVisaoGeral()

  // Degradação graciosa: sem workspace/pipeline (migration 0019 não aplicada) a
  // página avisa em vez de quebrar.
  if (!dados.configurado) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seu pipeline de vendas e oportunidades
          </p>
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

  return <CrmView dados={dados} />
}
