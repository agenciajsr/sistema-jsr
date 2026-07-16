'use client'

// Card "Regiões" — ranking top ~10 regiões por resultado da chave-herói:
// barra proporcional, resultados, investimento e custo por resultado.
// Dados refletem a janela ~30d do sync (mesma limitação dos anúncios).

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LinhaRegiao } from '@/lib/trafego/painel'
import type { ChaveHeroi } from '@/lib/trafego/aggregate'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorNumero = new Intl.NumberFormat('pt-BR')

const TITULO_POR_HEROI: Record<ChaveHeroi, string> = {
  vendas: 'Regiões que mais vendem',
  leads: 'Regiões que mais geram leads',
  conversas: 'Regiões que mais geram conversas',
}

type RegioesSectionProps = {
  regioes: LinhaRegiao[]
  heroiChave: ChaveHeroi
  labelHeroi: string
}

export function RegioesSection({ regioes, heroiChave, labelHeroi }: RegioesSectionProps) {
  const top = regioes.slice(0, 10)
  const maxResultados = Math.max(...top.map((r) => r.resultados), 1)

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">{TITULO_POR_HEROI[heroiChave]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados de regiões ainda — rode uma sincronização.
          </p>
        ) : (
          <>
            <div className="space-y-2.5">
              {top.map((r, idx) => (
                <div key={r.region} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2 font-medium">
                      <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {idx + 1}º
                      </span>
                      <span className="truncate" title={r.region}>
                        {r.region}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatadorNumero.format(r.resultados)}
                      </span>{' '}
                      {labelHeroi.toLowerCase()} · {formatadorMoeda.format(r.spend)}
                      {r.custoPorResultado !== null && (
                        <> · {formatadorMoeda.format(r.custoPorResultado)}/result.</>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((r.resultados / maxResultados) * 100, 2)}%`,
                        backgroundColor: 'var(--chart-1)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="rounded-md bg-muted/50 py-1.5 text-center text-xs text-muted-foreground">
              Regiões refletem os últimos ~30 dias da sincronização com o Meta, independente do
              período selecionado.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
