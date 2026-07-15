import { BarChart3 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { corOrigem, nomeOrigem } from '@/lib/crm/origem'
import type { OrigemDistrib } from '@/lib/crm/dados'

// Barra "Origem dos leads" do rodape do CRM (mockup): uma pilula por canal com o
// percentual REAL sobre o total de oportunidades abertas do pipeline.
// Server-friendly: recebe a distribuicao ja agregada no banco (GROUP BY origem).

export function BarraOrigemLeads({ origens }: { origens: OrigemDistrib[] }) {
  // Maior percentual primeiro — o canal dominante aparece na frente.
  const ordenadas = [...origens].sort((a, b) => b.pct - a.pct)

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 border-none p-4 shadow-[var(--shadow-sm)]">
      <span className="text-sm font-semibold">Origem dos leads</span>

      {ordenadas.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sem oportunidades abertas</span>
      ) : (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {ordenadas.map((o) => (
            <span
              key={o.origem}
              className="flex items-center gap-2 rounded-full bg-muted/60 py-1 pl-2 pr-3 text-xs font-medium"
              title={`${o.total} oportunidade(s)`}
            >
              <span className={cn('size-2 shrink-0 rounded-full', corOrigem(o.origem))} />
              {nomeOrigem(o.origem)}
              <span className="tabular-nums text-muted-foreground">{o.pct}%</span>
            </span>
          ))}
        </div>
      )}

      {/* Inerte por ora: o relatorio completo de origem ainda nao existe. */}
      <span
        className="flex cursor-not-allowed items-center gap-1.5 text-xs font-medium text-muted-foreground/70"
        title="Em breve"
      >
        <BarChart3 className="size-3.5" />
        Ver relatorio completo
      </span>
    </Card>
  )
}
