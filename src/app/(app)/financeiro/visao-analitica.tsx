import { PlusCircle, RefreshCw, Repeat, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import type { VisaoAnaliticaData } from '@/actions/financeiro'
import type { Faixa } from '@/lib/financeiro/calculos'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const COR_TEXTO_FAIXA: Record<Faixa, string> = {
  saudavel: 'text-chart-success',
  atencao: 'text-chart-warning',
  critico: 'text-destructive',
}

const COR_BARRA_FAIXA: Record<Faixa, string> = {
  saudavel: 'bg-chart-success',
  atencao: 'bg-chart-warning',
  critico: 'bg-destructive',
}

const ROTULO_FAIXA: Record<Faixa, string> = {
  saudavel: 'Saudavel',
  atencao: 'Atencao',
  critico: 'Critico',
}

function corRenovacao(percentual: number): 'success' | 'warning' | 'danger' {
  if (percentual >= 80) return 'success'
  if (percentual >= 50) return 'warning'
  return 'danger'
}

/** Cor da barra do Top 5: quanto mais concentrado, mais perigoso. */
function corTop5(percentual: number): string {
  if (percentual >= 80) return 'bg-destructive'
  if (percentual >= 60) return 'bg-chart-warning'
  return 'bg-chart-success'
}

export function VisaoAnalitica({ dados }: { dados: VisaoAnaliticaData }) {
  const { taxaRenovacao, dependencia, despesasVsFaturamento: dvf, variacao } = dados

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Taxa de Renovacao"
          value={`${taxaRenovacao.percentual}%`}
          icon={RefreshCw}
          color={corRenovacao(taxaRenovacao.percentual)}
          helper={`${taxaRenovacao.renovados}/${taxaRenovacao.total} contratos`}
        />
        <StatCard
          label="MRR Previsto"
          value={formatadorMoeda.format(dependencia.mrrTotal)}
          icon={Repeat}
          color="success"
          helper="Receita recorrente esperada"
          trend={
            variacao.mrr !== null
              ? {
                  value: `${Math.abs(variacao.mrr)}%`,
                  direction: variacao.mrr >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <StatCard
          label="Receita Avulsa"
          value={formatadorMoeda.format(dados.receitaAvulsa)}
          icon={PlusCircle}
          color="primary"
          helper="Extras + antecipados"
        />
        <StatCard
          label="Lucro/Cliente"
          value={formatadorMoeda.format(dados.lucroPorCliente)}
          icon={Users}
          color={dados.lucroPorCliente >= 0 ? 'success' : 'danger'}
          helper={`${dados.clientesAtivos} clientes ativos`}
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Despesas vs Faturamento</CardTitle>
        </CardHeader>
        <CardContent>
          {dvf.percentual === null || dvf.faixa === null ? (
            <p className="text-sm text-muted-foreground">Sem receita no periodo</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-semibold tabular-nums ${COR_TEXTO_FAIXA[dvf.faixa]}`}>
                  {dvf.percentual}%
                </span>
                <span className={`text-sm font-medium ${COR_TEXTO_FAIXA[dvf.faixa]}`}>
                  {ROTULO_FAIXA[dvf.faixa]}
                </span>
              </div>

              {/* Clamp em 100%: a despesa pode exceder a receita. */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${COR_BARRA_FAIXA[dvf.faixa]}`}
                  style={{ width: `${Math.min(dvf.percentual, 100)}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Saudavel ate 60% | Atencao 60-80% | Critico 80%+
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Despesas: {formatadorMoeda.format(dvf.despesa)} | Receita:{' '}
                {formatadorMoeda.format(dvf.receita)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Dependencia de Faturamento</CardTitle>
          <p className="text-xs text-muted-foreground">
            Quanto do seu MRR esta concentrado nos maiores clientes
          </p>
        </CardHeader>
        <CardContent>
          {dependencia.topClientes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum contrato vigente.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground tabular-nums">
                    Top 5 Clientes — {dependencia.percentTop5}% do MRR
                  </p>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${corTop5(dependencia.percentTop5)}`}
                      style={{ width: `${Math.min(dependencia.percentTop5, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground tabular-nums">
                    Top 10 — {dependencia.percentTop10}%
                  </p>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(dependencia.percentTop10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {dependencia.topClientes.slice(0, 5).map((cliente) => (
                  <div key={cliente.nome} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{cliente.nome}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {formatadorMoeda.format(cliente.valor)}{' '}
                      <span className="text-muted-foreground">{cliente.percentual}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
