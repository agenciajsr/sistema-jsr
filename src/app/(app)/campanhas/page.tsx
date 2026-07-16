import { Radio, Target, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

import { Card } from '@/components/ui/card'
import { SyncButton } from '@/components/trafego/sync-button'
import { SeletorCampanhas } from '@/components/trafego/seletor-campanhas'
import { ContasNaoVinculadas } from '@/components/trafego/contas-nao-vinculadas'
import { CriativosCampeoes } from '@/components/trafego/criativos-campeoes'
import { HealthScoreCliente } from '@/components/trafego/health-score-cliente'
import { GradeKpis } from '@/components/trafego/grade-kpis'
import { GraficoPerformance } from '@/components/trafego/grafico-performance'
import { TabelaNiveis } from '@/components/trafego/tabela-niveis'
import { FunilConversao } from '@/components/trafego/funil-conversao'
import { DemografiaSection } from '@/components/trafego/demografia-section'
import { RegioesSection } from '@/components/trafego/regioes-section'
import {
  getContasNaoVinculadas,
  getPreferenciasCampanhas,
  getUltimaSync,
  listarClientes,
} from '@/actions/trafego'
import { listarClientesComContas, type CriativoRanking, type Periodo } from '@/lib/trafego/aggregate'
import { getPainelCampanhas } from '@/lib/trafego/painel'
import { getSaudeDoCliente } from '@/lib/saude/avaliar-campanhas'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 60s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

const PERIODOS_VALIDOS: Periodo[] = ['hoje', 'ontem', '7d', '30d']

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string }>
}) {
  const sp = await searchParams
  const cliente = sp.cliente ?? null
  const periodo: Periodo = PERIODOS_VALIDOS.includes(sp.periodo as Periodo)
    ? (sp.periodo as Periodo)
    : '30d'

  // Queries de topo em paralelo (padrão pré-existente da página);
  // as chamadas pesadas do painel rodam SEQUENCIAIS logo abaixo.
  const [clientesComContas, contasNaoVinculadas, clientesParaVinculo, ultimaSync] =
    await Promise.all([
      listarClientesComContas(),
      getContasNaoVinculadas(),
      listarClientes(),
      getUltimaSync(),
    ])

  // SEQUENCIAL de propósito (pool max=5, decisão 260714-ita): painel -> preferências -> saúde.
  const painel = cliente ? await getPainelCampanhas(cliente, periodo) : null
  const preferencias = cliente ? await getPreferenciasCampanhas(cliente) : null
  const saude = cliente && painel?.temDados ? await getSaudeDoCliente(cliente) : null

  const clienteSelecionado = clientesComContas.find((c) => c.id === cliente) ?? null
  const semNada = clientesComContas.length === 0 && contasNaoVinculadas.length === 0

  // Criativos campeões derivados do nível anúncios do painel.
  const topCriativos: CriativoRanking[] = painel
    ? [...painel.anuncios]
        .map((a) => ({
          adId: a.adId,
          adName: a.adName,
          adsetName: a.adsetName ?? '',
          thumbUrl: a.thumbnailUrl,
          spend: a.spend,
          resultadoPrimario: a.resultadoHeroi,
          cpaOuCpl: a.resultadoHeroi > 0 ? a.spend / a.resultadoHeroi : null,
        }))
        .sort((x, y) => y.resultadoPrimario - x.resultadoPrimario || y.spend - x.spend)
        .slice(0, 8)
    : []

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
      {cliente && painel && !painel.temDados && (
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

      {/* Cliente com dados: painel completo */}
      {cliente && painel && painel.temDados && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {painel.contasUnificadas}{' '}
              {painel.contasUnificadas === 1 ? 'conta unificada' : 'contas unificadas'}
            </p>
            {saude && <HealthScoreCliente score={saude.score} rotulo={saude.rotulo} />}
          </div>

          <GradeKpis
            totaisAtual={painel.totaisAtual}
            totaisAnterior={painel.totaisAnterior}
            preferencias={preferencias?.kpis ?? null}
            clienteId={cliente}
          />

          <GraficoPerformance serie={painel.seriePorDia} heroiChave={painel.heroi.chave} />

          <TabelaNiveis
            campanhas={painel.campanhas}
            conjuntos={painel.conjuntos}
            anuncios={painel.anuncios}
            labelHeroi={painel.heroi.label}
          />

          {painel.campanhas.length > 0 && (
            <FunilConversao
              campanhas={painel.campanhas}
              funilSalvo={preferencias?.funil ?? null}
              clienteId={cliente}
            />
          )}

          {/* Etapa 2 — após o Funil de Conversão (ordem da referência) */}
          <DemografiaSection demografia={painel.demografia} />

          <RegioesSection
            regioes={painel.regioes}
            heroiChave={painel.heroi.chave}
            labelHeroi={painel.heroi.label}
          />

          <CriativosCampeoes topCriativos={topCriativos} labelHeroi={painel.heroi.label} />
        </div>
      )}

      {/* Sempre ao final: contas soltas (o componente se esconde se vazio) */}
      <ContasNaoVinculadas contas={contasNaoVinculadas} clientes={clientesParaVinculo} />
    </div>
  )
}
