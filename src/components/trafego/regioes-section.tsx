'use client'

// Card "Regiões" — ranking top ~10 regiões com MÉTRICA ADAPTATIVA:
// - ranking.metrica === 'heroi': ranqueia pela chave-herói do cliente (vendas/leads/
//   conversas), com custo por resultado — comportamento padrão.
// - ranking.metrica === 'linkClicks': o Meta não entregou a chave-herói por região
//   (não entrega conversão de pixel por região — limitação de privacidade), então o
//   ranking usa cliques no link, o título vira "Regiões com mais tráfego" e o card
//   exibe uma nota explicando a limitação. Melhor que mostrar zeros sem explicação.
// Dados refletem a janela ~30d do sync (mesma limitação dos anúncios).

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RankingRegioes } from '@/lib/trafego/painel'
import type { ChaveHeroi } from '@/lib/trafego/aggregate'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorNumero = new Intl.NumberFormat('pt-BR')

const TITULO_POR_HEROI: Record<ChaveHeroi, string> = {
  vendas: 'Regiões que mais vendem',
  leads: 'Regiões que mais geram leads',
  conversas: 'Regiões que mais geram conversas',
}

type RegioesSectionProps = {
  ranking: RankingRegioes
  heroiChave: ChaveHeroi
  labelHeroi: string
}

export function RegioesSection({ ranking, heroiChave, labelHeroi }: RegioesSectionProps) {
  const top = ranking.linhas.slice(0, 10)
  const modoHeroi = ranking.metrica === 'heroi'

  const valorDaLinha = (r: RankingRegioes['linhas'][number]) => (modoHeroi ? r.resultados : r.linkClicks)
  const maxValor = Math.max(...top.map(valorDaLinha), 1)

  const titulo = modoHeroi ? TITULO_POR_HEROI[heroiChave] : 'Regiões com mais tráfego'
  const unidade = modoHeroi ? labelHeroi.toLowerCase() : 'cliques no link'
  const sufixoCusto = modoHeroi ? '/result.' : '/clique no link'

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
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
                        {formatadorNumero.format(valorDaLinha(r))}
                      </span>{' '}
                      {unidade} · {formatadorMoeda.format(r.spend)}
                      {r.custoPorResultado !== null && (
                        <>
                          {' '}
                          · {formatadorMoeda.format(r.custoPorResultado)}
                          {sufixoCusto}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((valorDaLinha(r) / maxValor) * 100, 2)}%`,
                        backgroundColor: 'var(--chart-1)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!modoHeroi && (
              <p className="rounded-md bg-muted/50 px-2 py-1.5 text-center text-xs text-muted-foreground">
                O Meta não entrega compras e leads de pixel separados por região (limitação de
                privacidade da plataforma). Por isso este ranking usa cliques no link.
              </p>
            )}
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
