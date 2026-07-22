import { Radio, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

import { Card } from '@/components/ui/card'
import { SyncButton } from '@/components/trafego/sync-button'
import { SeletorCampanhas } from '@/components/trafego/seletor-campanhas'
import { ContasNaoVinculadas } from '@/components/trafego/contas-nao-vinculadas'
import { CriativosCampeoes } from '@/components/trafego/criativos-campeoes'
import { HealthScoreCliente } from '@/components/trafego/health-score-cliente'
import { GradeKpis } from '@/components/trafego/grade-kpis'
import { LandingClientes } from '@/components/trafego/landing-clientes'
import { BotaoVoltar } from '@/components/ui/botao-voltar'
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
import {
  classificarObjetivo,
  getInvestido30dPorCliente,
  getPlataformasDoCliente,
  listarClientesComContas,
  type CriativoRanking,
  type Periodo,
} from '@/lib/trafego/aggregate'
import { SeletorPlataforma, BadgePlataforma } from '@/components/trafego/seletor-plataforma'
import { getPainelCampanhas, getResumoLandingPorCliente } from '@/lib/trafego/painel'
import { getAcoesDoDia } from '@/lib/trafego/acoes-dia'
import { AcoesDoDia } from '@/components/trafego/acoes-do-dia'
import { getSaudeDoCliente } from '@/lib/saude/avaliar-campanhas'
import {
  breakdownDoCliente,
  resolverMetas,
  scoreSemaforo,
  type MetaMetrica,
} from '@/lib/trafego/semaforo'
import { calcularMetricas } from '@/lib/trafego/metricas'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 60s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

const PERIODOS_VALIDOS: Periodo[] = ['hoje', 'ontem', '7d', '30d']
const PLATAFORMAS_VALIDAS = ['meta', 'google', 'compilado'] as const

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string; plataforma?: string }>
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

  // Plataformas do cliente ANTES do painel: preciso do filtro resolvido para
  // chamar getPainelCampanhas. Abas só existem com 2 plataformas (default Meta).
  const plataformasCliente = cliente ? await getPlataformasDoCliente(cliente) : []
  const temAbas = plataformasCliente.length >= 2
  const plataformaParam = PLATAFORMAS_VALIDAS.includes(sp.plataforma as (typeof PLATAFORMAS_VALIDAS)[number])
    ? (sp.plataforma as 'meta' | 'google' | 'compilado')
    : 'meta'
  const abaAtiva: 'meta' | 'google' | 'compilado' | null = temAbas ? plataformaParam : null
  // Filtro passado ao painel: 'compilado' e cliente-de-1-plataforma => undefined
  // (todas as contas) = comportamento byte-a-byte idêntico ao de hoje (REGRA DURA).
  const plataformaFiltro: 'meta' | 'google' | undefined =
    abaAtiva === 'meta' || abaAtiva === 'google' ? abaAtiva : undefined
  const ehGoogle = abaAtiva === 'google'

  // SEQUENCIAL de propósito (pool max=5, decisão 260714-ita): painel -> preferências -> saúde.
  const painel = cliente ? await getPainelCampanhas(cliente, periodo, plataformaFiltro) : null
  const preferencias = cliente ? await getPreferenciasCampanhas(cliente) : null

  const clienteSelecionado = clientesComContas.find((c) => c.id === cliente) ?? null

  // Semáforo (Feature 1): metas efetivas do cliente (salvas no Organizar ou
  // defaults do objetivo). Score de Saúde agora é função dos status do semáforo
  // (ponderado por gasto); sem metas/dado avaliável cai no score legado.
  const classeCliente = classificarObjetivo(clienteSelecionado?.objetivoPrincipal ?? null)
  const metas = resolverMetas(preferencias?.kpis ?? null, classeCliente)
  const saudeSemaforo = painel?.temDados ? scoreSemaforo(painel.campanhas, metas) : null
  const saude =
    saudeSemaforo ??
    (cliente && painel?.temDados ? await getSaudeDoCliente(cliente) : null)
  const breakdownSaude =
    painel?.temDados && saudeSemaforo
      ? breakdownDoCliente(calcularMetricas(painel.totaisAtual), metas, {
          impressions: painel.totaisAtual.impressions,
          spend: painel.totaisAtual.spend,
        })
      : []
  const metasRecord: Record<string, MetaMetrica> = Object.fromEntries(metas)

  // Ações do dia (Feature 3) — sequencial, depois das chamadas acima.
  const acoesDoDia = cliente && painel?.temDados ? await getAcoesDoDia(cliente) : []

  // Tela inicial (sem cliente): 2 chamadas agregadas leves p/ os cards — nunca rodar
  // getResumoCliente/getSaude por cliente aqui (pesadas, pool max=5).
  const investido30d = !cliente ? await getInvestido30dPorCliente() : null
  const resumoLanding = !cliente ? await getResumoLandingPorCliente(periodo) : null
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
          {/* Com cliente selecionado, volta para a tela inicial de cards. */}
          {cliente && <BotaoVoltar href="/campanhas" label="Todos os clientes" className="mb-1" />}
          <h1 className="text-2xl font-semibold tracking-tight">
            {clienteSelecionado ? clienteSelecionado.nome : 'Campanhas'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance unificada por cliente: verba, resultados e campanhas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SeletorCampanhas periodoAtual={periodo as string} />
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

      {/* Ha clientes com contas, mas nenhum selecionado: tela inicial com cards */}
      {!semNada && !cliente && clientesComContas.length > 0 && (
        <LandingClientes
          clientes={clientesComContas.map((c) => ({
            id: c.id,
            nome: c.nome,
            nicho: c.nicho,
            objetivoPrincipal: c.objetivoPrincipal,
          }))}
          investido30d={investido30d ?? new Map()}
          periodo={periodo}
          resumo={resumoLanding ?? undefined}
        />
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
            {/* Single-platform mostra a plataforma real do cliente; com abas, a aba ativa. */}
            <BadgePlataforma plataforma={abaAtiva ?? (plataformasCliente[0] ?? 'meta')} />
            {temAbas && <SeletorPlataforma plataformaAtual={abaAtiva ?? 'meta'} />}
            {saude && (
              <HealthScoreCliente score={saude.score} rotulo={saude.rotulo} breakdown={breakdownSaude} />
            )}
          </div>

          <GradeKpis
            // key = cliente: força remontar ao trocar de cliente. Sem isto o React
            // reaproveita a instância, o useState inicial NÃO relê `preferencias` e a
            // grade mostra as métricas do cliente anterior — e o salvamento otimista
            // grava essa lista errada por cima do cliente atual (bug real, 15/jul/2026).
            key={cliente}
            totaisAtual={painel.totaisAtual}
            totaisAnterior={painel.totaisAnterior}
            preferencias={preferencias?.kpis ?? null}
            clienteId={cliente}
            clienteNome={clienteSelecionado?.nome ?? 'este cliente'}
            classe={classificarObjetivo(clienteSelecionado?.objetivoPrincipal ?? null)}
          />

          <GraficoPerformance serie={painel.seriePorDia} heroiChave={painel.heroi.chave} />

          <TabelaNiveis
            campanhas={painel.campanhas}
            conjuntos={painel.conjuntos}
            anuncios={painel.anuncios}
            labelHeroi={painel.heroi.label}
            metas={metasRecord}
            soloCampanhas={ehGoogle}
          />

          {painel.campanhas.length > 0 && (
            <FunilConversao
              // key = cliente: mesmo motivo da GradeKpis (etapas/campanhas do funil
              // nascem de useState e vazariam do cliente anterior).
              key={cliente}
              campanhas={painel.campanhas}
              funilSalvo={preferencias?.funil ?? null}
              clienteId={cliente}
            />
          )}

          {/* Seções que o sync do Google ainda não alimenta (Parte 2e): ocultas
              na aba Google, substituídas por uma nota honesta. */}
          {ehGoogle && (
            <Card className="border-none p-6 text-center shadow-[var(--shadow-sm)]">
              <p className="text-sm text-muted-foreground">
                Conjuntos, anúncios, demografia e regiões: em breve para Google Ads.
              </p>
            </Card>
          )}

          {/* Etapa 2 — após o Funil de Conversão (ordem da referência) */}
          {!ehGoogle && <DemografiaSection demografia={painel.demografia} />}

          {!ehGoogle && (
            <RegioesSection
              ranking={painel.regioes}
              heroiChave={painel.heroi.chave}
              labelHeroi={painel.heroi.label}
            />
          )}

          {/* Ações do dia (Feature 3) — acima dos Criativos campeões, como na spec */}
          <AcoesDoDia clienteId={cliente} acoes={acoesDoDia} />

          {!ehGoogle && (
            <CriativosCampeoes topCriativos={topCriativos} labelHeroi={painel.heroi.label} />
          )}
        </div>
      )}

      {/* Sempre ao final: contas soltas (o componente se esconde se vazio) */}
      <ContasNaoVinculadas contas={contasNaoVinculadas} clientes={clientesParaVinculo} />
    </div>
  )
}
