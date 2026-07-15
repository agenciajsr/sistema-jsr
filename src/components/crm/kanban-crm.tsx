'use client'

import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardOportunidade } from '@/components/crm/card-oportunidade'
import type { ColunaKanban, EtapaKanban } from '@/lib/crm/dados'

// Board do CRM no formato do mockup: cada coluna mostra no header o nome da
// etapa, a contagem, o VALOR TOTAL PARADO na etapa e a probabilidade.
// Mover etapa continua via Select no card (sem drag-and-drop no v1).

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function KanbanCrm({
  colunas,
  etapas,
  oportunidadesVisiveis,
  onAdicionar,
}: {
  colunas: ColunaKanban[]
  etapas: EtapaKanban[]
  // Filtro da busca: quando presente, so renderiza os cards com id no Set.
  // A contagem e o valor do header seguem os dados ORIGINAIS da coluna — o
  // header descreve a etapa inteira, nao o recorte da busca.
  oportunidadesVisiveis?: Set<string>
  onAdicionar?: (etapaId: string) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {colunas.map((coluna) => {
        const visiveis = oportunidadesVisiveis
          ? coluna.oportunidades.filter((o) => oportunidadesVisiveis.has(o.id))
          : coluna.oportunidades
        const filtrando = oportunidadesVisiveis != null

        return (
          <div key={coluna.etapa.id} className="flex w-72 shrink-0 flex-col gap-3">
            <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-sm)]">
              {/* Faixa da cor da etapa (quando cadastrada), como no mockup. */}
              <div
                className="h-1 w-full"
                style={{ backgroundColor: coluna.etapa.cor ?? 'var(--border)' }}
              />
              <div className="space-y-1 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{coluna.etapa.nome}</p>
                  <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
                    {coluna.total}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {/* O dinheiro PARADO nesta etapa (soma das oportunidades abertas). */}
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {coluna.somaValor > 0 ? formatoBRL.format(coluna.somaValor) : '—'}
                  </span>
                  {coluna.etapa.probabilidade != null && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {coluna.etapa.probabilidade}% prob.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {visiveis.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  {filtrando && coluna.total > 0 ? 'Nada encontrado' : 'Sem oportunidades'}
                </p>
              ) : (
                visiveis.map((oportunidade) => (
                  <CardOportunidade
                    key={oportunidade.id}
                    oportunidade={oportunidade}
                    etapas={etapas}
                  />
                ))
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-full justify-start text-xs text-muted-foreground',
                !onAdicionar && 'cursor-not-allowed opacity-60',
              )}
              title={onAdicionar ? undefined : 'Em breve'}
              onClick={onAdicionar ? () => onAdicionar(coluna.etapa.id) : undefined}
            >
              <Plus className="size-3.5" />
              Adicionar oportunidade
            </Button>
          </div>
        )
      })}
    </div>
  )
}
