import { Suspense } from 'react'
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Percent,
  Radio,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SyncButton } from '@/components/trafego/sync-button'
import { SeletorCampanhas } from '@/components/trafego/seletor-campanhas'
import { ContasNaoVinculadas } from '@/components/trafego/contas-nao-vinculadas'
import { GraficoVerba } from '@/components/trafego/grafico-verba'
import { CriativosCampeoes } from '@/components/trafego/criativos-campeoes'
import { ConjuntosPerformam } from '@/components/trafego/conjuntos-performam'
import { HealthScoreCliente } from '@/components/trafego/health-score-cliente'
import { AbasCampanhas } from '@/components/trafego/abas-campanhas'
import { PainelVerbas } from '@/components/trafego/painel-verbas'
import { VerbaDetalhe } from '@/components/trafego/verba-detalhe'
import {
  getContasNaoVinculadas,
  getUltimaSync,
  listarClientes,
} from '@/actions/trafego'
import { getResumoCliente, listarClientesComContas, type Periodo } from '@/lib/trafego/aggregate'
import { getSaudeDoCliente } from '@/lib/saude/avaliar-campanhas'
import { getVerbasTodosClientes, getVerbaCliente } from '@/lib/trafego/verbas'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')
const formatadorPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function moeda(v: number | null): string {
  return v === null ? '-' : formatadorMoeda.format(v)
}
function numero(v: number | null): string {
  return v === null ? '-' : formatadorNumero.format(v)
}
function pct(v: number | null): string {
  return v === null ? '-' : `${formatadorPct.format(v)}%`
}

const PERIODOS_VALIDOS: Periodo[] = ['hoje', 'ontem', '7d', '30d']
const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  '7d': '7d',
  '30d': '30d',
}

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string; tab?: string }>
}) {
  const sp = await searchParams
  const cliente = sp.cliente ?? null
  const periodo: Periodo = PERIODOS_VALIDOS.includes(sp.periodo as Periodo)
    ? (sp.periodo as Periodo)
    : '30d'
  const abaAtual = sp.tab === 'verbas' ? 'verbas' : 'performance'

  const [clientesComContas, contasNaoVinculadas, clientesParaVinculo, ultimaSync] =
    await Promise.all([
      listarClientesComContas(),
      getContasNaoVinculadas(),
      listarClientes(),
      getUltimaSync(),
    ])

  const resumo = cliente
    ? await getResumoCliente(cliente, periodo)
    : null

  // Health score do cliente selecionado (só quando há dados reais no período).
  const saude = cliente && resumo?.temDados ? await getSaudeDoCliente(cliente) : null

  // Dados de verbas (apenas quando aba verbas está ativa)
  const verbasData = abaAtual === 'verbas'
    ? cliente
      ? await getVerbaCliente(cliente)
      : await getVerbasTodosClientes()
    : null

  const clienteSelecionado = clientesComContas.find((c) => c.id === cliente) ?? null
  const semNada = clientesComContas.length === 0 && contasNaoVinculadas.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Performance unificada por cliente: verba, resultados e campanhas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SeletorCampanhas
            clientes={clientesComContas.map((c) => ({ id: c.id, nome: c.nome }))}
            clienteAtual={cliente}
            periodoAtual={periodo as string}
          />
          {ultimaSync && (
            <span className="text-xs text-muted-foreground">
              Última sync: {formatDistanceToNow(ultimaSync, { addSuffix: true, locale: ptBR })}
            </span>
          )}
          <SyncButton />
        </div>
      </div>

      {/* Abas: Performance | Verbas */}
      <Suspense fallback={null}>
        <AbasCampanhas abaAtual={abaAtual} />
      </Suspense>

      {/* ═══ ABA VERBAS ═══ */}
      {abaAtual === 'verbas' && (
        <div className="space-y-6">
          {cliente && verbasData && 'serieDiaria' in verbasData ? (
            <VerbaDetalhe dados={verbasData} />
          ) : !cliente && Array.isArray(verbasData) ? (
            <PainelVerbas verbas={verbasData} />
          ) : (
            <Card className="border-none p-12 text-center shadow-[var(--shadow-sm)]">
              <div className="mx-auto max-w-md space-y-2">
                <Wallet className="mx-auto size-12 text-muted-foreground/50" />
                <h2 className="text-lg font-medium">
                  {cliente ? 'Cliente sem verba configurada' : 'Selecione um cliente ou veja a visão geral'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {cliente
                    ? 'Configure a verba mensal na ficha do cliente para acompanhar aqui.'
                    : 'A visão geral mostra todos os clientes com verba configurada.'
                  }
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ ABA PERFORMANCE (conteúdo original) ═══ */}
      {abaAtual === 'performance' && <>
      {/* Estado vazio total: nada sincronizado */}
      {semNada && (
        <Card className="border-none p-12 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto max-w-md space-y-4">
            <Radio className="mx-auto size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">Nenhuma conta sincronizada</h2>
            <p className="text-sm text-muted-foreground">
              Clique em Sincronizar para buscar as contas da sua Business Manager.
            </p>
            <div className="flex justify-center">
              <SyncButton />
            </div>
          </div>
        </Card>
      )}

      {/* Ha clientes com contas, mas nenhum selecionado */}
      {!semNada && !cliente && clientesComContas.length > 0 && (
        <Card className="border-none p-12 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto max-w-md space-y-2">
            <Target className="mx-auto size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">Selecione um cliente</h2>
            <p className="text-sm text-muted-foreground">
              Escolha um cliente acima para ver a performance unificada de todas as contas dele.
            </p>
          </div>
        </Card>
      )}

      {/* Cliente selecionado, sem dados no periodo */}
      {cliente && resumo && !resumo.temDados && (
        <Card className="border-none p-12 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto max-w-md space-y-2">
            <TrendingUp className="mx-auto size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">
              Sem dados neste período{clienteSelecionado ? ` para ${clienteSelecionado.nome}` : ''}
            </h2>
            <p className="text-sm text-muted-foreground">
              Não há insights para o período selecionado. Tente outro período ou sincronize.
            </p>
          </div>
        </Card>
      )}

      {/* Cliente com dados: dashboard premium */}
      {cliente && resumo && resumo.temDados && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {resumo.contasUnificadas}{' '}
              {resumo.contasUnificadas === 1 ? 'conta unificada' : 'contas unificadas'}
            </p>
            {saude && <HealthScoreCliente score={saude.score} rotulo={saude.rotulo} />}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Verba (${PERIODO_LABELS[periodo]})`}
              value={formatadorMoeda.format(resumo.totais.spend)}
              icon={Wallet}
              color="primary"
            />
            <StatCard
              label={resumo.heroi.label}
              value={numero(
                resumo.heroi.chave === 'vendas'
                  ? resumo.totais.vendas
                  : resumo.heroi.chave === 'conversas'
                    ? resumo.totais.conversas
                    : resumo.totais.leads,
              )}
              icon={Target}
              color="success"
            />
            <StatCard
              label={
                resumo.heroi.chave === 'vendas'
                  ? 'CPA (custo/venda)'
                  : `Custo por ${resumo.heroi.label.toLowerCase()}`
              }
              value={moeda(
                resumo.heroi.chave === 'vendas'
                  ? resumo.derivadas.cpa
                  : resumo.derivadas.custoPorResultadoHeroi,
              )}
              icon={TrendingUp}
              color="warning"
            />
            <StatCard
              label="Impressões"
              value={numero(resumo.totais.impressions)}
              icon={Eye}
              color="primary"
            />
            <StatCard
              label="Cliques"
              value={numero(resumo.totais.clicks)}
              icon={MousePointerClick}
              color="primary"
            />
            <StatCard label="CTR" value={pct(resumo.derivadas.ctr)} icon={Percent} color="success" />
            <StatCard
              label="Alcance"
              value={numero(resumo.totais.reach)}
              icon={Users}
              color="primary"
            />
            {resumo.receita > 0 && (
              <StatCard
                label="Receita"
                value={formatadorMoeda.format(resumo.receita)}
                icon={DollarSign}
                color="success"
              />
            )}
            {resumo.roas !== null && (
              <StatCard
                label="ROAS"
                value={`${resumo.roas.toFixed(2)}x`}
                icon={TrendingUp}
                color="success"
              />
            )}
          </div>

          <Card className="border-none shadow-[var(--shadow-sm)]">
            <CardHeader>
              <CardTitle className="text-base">Verba por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {resumo.serieSpendPorDia.length > 0 ? (
                <GraficoVerba serie={resumo.serieSpendPorDia} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sem série de verba no período.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-[var(--shadow-sm)]">
            <CardHeader>
              <CardTitle className="text-base">Campanhas que mais performam</CardTitle>
            </CardHeader>
            <CardContent>
              {resumo.ranking.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">{resumo.heroi.label}</TableHead>
                      <TableHead className="text-right">
                        {resumo.heroi.chave === 'vendas' ? 'CPA' : 'Custo/result.'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumo.ranking.map((c) => (
                      <TableRow key={c.campaignId}>
                        <TableCell className="font-medium">{c.campaignName}</TableCell>
                        <TableCell className="text-right">
                          {formatadorMoeda.format(c.spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatadorNumero.format(c.resultadoPrimario)}
                        </TableCell>
                        <TableCell className="text-right">{moeda(c.cpaOuCpl)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sem campanhas com resultados no período.
                </p>
              )}
            </CardContent>
          </Card>

          <CriativosCampeoes
            topCriativos={resumo.topCriativos}
            labelHeroi={resumo.heroi.label}
          />

          <ConjuntosPerformam
            topConjuntos={resumo.topConjuntos}
            labelHeroi={resumo.heroi.label}
          />
        </div>
      )}

      {/* Sempre ao final: contas soltas (o componente se esconde se vazio) */}
      <ContasNaoVinculadas contas={contasNaoVinculadas} clientes={clientesParaVinculo} />
      </>}
    </div>
  )
}
