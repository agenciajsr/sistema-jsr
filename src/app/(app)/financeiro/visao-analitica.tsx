import { Coins, Gauge, HeartCrack, PlusCircle, RefreshCw, Repeat, UserMinus, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import type { CacAquisicaoData, VisaoAnaliticaData, VisaoExecutivaData } from '@/actions/financeiro'
import type { Faixa } from '@/lib/financeiro/calculos'
import { CANAIS_AQUISICAO, ROTULO_CANAL, type CacCanal } from '@/lib/financeiro/cac'

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

function corChurn(percentual: number): 'success' | 'warning' | 'danger' {
  if (percentual <= 3) return 'success'
  if (percentual <= 8) return 'warning'
  return 'danger'
}

/** Relação LTV/CAC: verde ≥3 (saudável), amarelo 1–3, vermelho <1. */
function corLtvCac(relacao: number): 'success' | 'warning' | 'danger' {
  if (relacao >= 3) return 'success'
  if (relacao >= 1) return 'warning'
  return 'danger'
}

/** CAC do canal formatado como moeda, ou "—" quando indefinido. */
function formatarCac(cac: number | null): string {
  return cac === null ? '—' : formatadorMoeda.format(cac)
}

/**
 * Seção "CAC por canal + relação LTV/CAC" (quick-260720-pev). Cada canal mostra
 * o CAC do mês com o acumulado 3m/6m no helper; canal sem cliente ganho aparece
 * com "—" em vez de dividir por zero. Um card fecha com a relação LTV/CAC.
 */
function SecaoCac({ cac }: { cac: CacAquisicaoData | null }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">CAC por canal &amp; LTV/CAC</h2>
        <p className="text-xs text-muted-foreground">
          Quanto custa captar um cliente em cada canal e quantas vezes o retorno (LTV) cobre esse
          custo — LTV/CAC ≥ 3 é o alvo saudável.
        </p>
      </div>

      {cac === null ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          CAC indisponível — aplique a migration 0039 (
          <code className="text-xs">scripts/aplicar-migration-0039.ts</code>) para habilitar o
          lançamento de investimento em aquisição por canal.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CANAIS_AQUISICAO.map((canal) => {
              const mes = cac.porCanalMes.porCanal.find((c) => c.canal === canal) as CacCanal
              const tres = cac.porCanal3m.porCanal.find((c) => c.canal === canal) as CacCanal
              const seis = cac.porCanal6m.porCanal.find((c) => c.canal === canal) as CacCanal
              const semGanho = mes.clientesGanhos === 0
              return (
                <StatCard
                  key={canal}
                  label={`CAC — ${ROTULO_CANAL[canal]}`}
                  value={formatarCac(mes.cac)}
                  icon={Coins}
                  color="primary"
                  helper={
                    semGanho
                      ? `Sem cliente ganho no período · investido ${formatadorMoeda.format(mes.investimento)}`
                      : `${mes.clientesGanhos} cliente(s) · 3m ${formatarCac(tres.cac)} · 6m ${formatarCac(seis.cac)}`
                  }
                />
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="LTV / CAC"
              value={cac.ltvCac.relacao === null ? '—' : `${cac.ltvCac.relacao}x`}
              icon={Gauge}
              color={cac.ltvCac.relacao === null ? 'primary' : corLtvCac(cac.ltvCac.relacao)}
              helper={
                cac.ltvCac.relacao === null
                  ? cac.ltvCac.cacGeral === null
                    ? 'Sem cliente ganho no período para calcular o CAC geral'
                    : 'LTV ainda indefinido (sem contratos com valor conhecido)'
                  : `LTV ${cac.ltvCac.ltv !== null ? formatadorMoeda.format(cac.ltvCac.ltv) : '—'} ÷ CAC geral ${cac.ltvCac.cacGeral !== null ? formatadorMoeda.format(cac.ltvCac.cacGeral) : '—'}`
              }
            />
          </div>
        </>
      )}
    </div>
  )
}

/** Seção "Visão Executiva": churn, LTV e ranking de motivos de encerramento. */
function VisaoExecutiva({ dados }: { dados: VisaoExecutivaData | null }) {
  const formatadorPct = (p: number | null) => (p === null ? '—' : `${p}%`)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Visão Executiva</h2>
        <p className="text-xs text-muted-foreground">
          Churn, LTV e motivos de encerramento — com poucos clientes esses números oscilam bastante;
          leia a tendência, não o decimal.
        </p>
      </div>

      {dados === null ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Dados de churn indisponíveis — aplique a migration 0038 (
          <code className="text-xs">scripts/aplicar-migration-0038.ts</code>) para habilitar a data de
          encerramento dos clientes.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Churn do mês"
              value={formatadorPct(dados.churnMes.percentual)}
              icon={UserMinus}
              color={
                dados.churnMes.percentual === null
                  ? 'primary'
                  : corChurn(dados.churnMes.percentual)
              }
              helper={
                dados.churnMes.percentual === null
                  ? 'Sem base de clientes no início do mês'
                  : `${dados.churnMes.encerrados} de ${dados.churnMes.base} clientes | 3m ${formatadorPct(dados.churn3m.percentual)} · 6m ${formatadorPct(dados.churn6m.percentual)}`
              }
            />
            <StatCard
              label="LTV médio"
              value={dados.ltv ? formatadorMoeda.format(dados.ltv.valor) : '—'}
              icon={Repeat}
              color="primary"
              helper={
                dados.ltv
                  ? `Vida média ${dados.ltv.vidaMediaMeses} meses × ticket ${formatadorMoeda.format(dados.ltv.ticketMedio)}`
                  : 'Sem contratos com valor conhecido'
              }
            />
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <HeartCrack className="size-4" />
                  Motivos de encerramento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dados.motivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum encerramento registrado.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dados.motivos.slice(0, 5).map((m) => (
                      <li key={m.motivo} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{m.motivo}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {m.quantidade}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export function VisaoAnalitica({
  dados,
  executiva = null,
  cac = null,
}: {
  dados: VisaoAnaliticaData
  executiva?: VisaoExecutivaData | null
  cac?: CacAquisicaoData | null
}) {
  const { taxaRenovacao, dependencia, despesasVsFaturamento: dvf, variacao } = dados

  return (
    <div className="space-y-6">
      <VisaoExecutiva dados={executiva} />
      <SecaoCac cac={cac} />
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
