'use client'

import { Badge } from '@/components/ui/badge'
import { CardOportunidade } from '@/components/crm/card-oportunidade'
import type { ColunaKanban, EtapaKanban } from '@/lib/crm/dados'

// Kanban FUNCIONAL simples (mover via Select, sem drag-and-drop no v1).
// O visual definitivo virá do mockup do usuário numa entrega futura.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function KanbanCrm({
  colunas,
  etapas,
}: {
  colunas: ColunaKanban[]
  etapas: EtapaKanban[]
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {colunas.map((coluna) => (
        <div key={coluna.etapa.id} className="w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{coluna.etapa.nome}</p>
              <Badge variant="secondary" className="text-[10px] tabular-nums">
                {coluna.total}
              </Badge>
            </div>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              {formatoBRL.format(coluna.somaValor)}
            </p>
          </div>

          <div className="space-y-2">
            {coluna.oportunidades.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                Sem oportunidades
              </p>
            ) : (
              coluna.oportunidades.map((oportunidade) => (
                <CardOportunidade
                  key={oportunidade.id}
                  oportunidade={oportunidade}
                  etapas={etapas}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
