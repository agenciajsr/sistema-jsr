'use client'

// Tabela por nível (referência: imagem 4): alterna campanhas/conjuntos/anúncios,
// busca por nome, filtro de status e linha de totais. SOMENTE visualização —
// status é badge, NUNCA switch de ação sobre a campanha.

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { ImageOff, Search } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { LinhaAnuncio, LinhaCampanha, LinhaConjunto, ObjetivoChip } from '@/lib/trafego/painel'
import {
  MIN_GASTO_LINHA,
  statusDaMetrica,
  type MetaMetrica,
  type StatusMeta,
} from '@/lib/trafego/semaforo'
import type { MetricaId } from '@/lib/trafego/metricas'

// Semáforo (Feature 1): fundo suave na CÉLULA que viola a meta — só em linhas
// com gasto >= R$20 no período (evita falso alarme em campanha recém-criada).
const FUNDO_STATUS: Partial<Record<StatusMeta, string>> = {
  atencao: 'bg-chart-warning/15',
  ruim: 'bg-destructive/15',
}

function classeCelula(
  id: MetricaId,
  valor: number | null,
  metas: Record<string, MetaMetrica> | undefined,
  linha: { spend: number; impressions: number },
): string | undefined {
  if (!metas || linha.spend < MIN_GASTO_LINHA) return undefined
  const status = statusDaMetrica(id, valor, metas[id], {
    impressions: linha.impressions,
    spend: linha.spend,
  })
  return status ? FUNDO_STATUS[status] : undefined
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorNumero = new Intl.NumberFormat('pt-BR')
const formatadorPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function moeda(v: number | null): string {
  return v === null ? '—' : formatadorMoeda.format(v)
}

type Nivel = 'campanhas' | 'conjuntos' | 'anuncios'
type FiltroStatus = 'todos' | 'ativos' | 'inativos'

// Linha normalizada dos três níveis para uma única tabela.
type LinhaNormalizada = {
  id: string
  nome: string
  thumbnailUrl: string | null
  temStatus: boolean
  ativo: boolean | null // null = nível sem effectiveStatus
  statusBruto: string | null // effective_status oficial (dot colorido)
  objetivo: ObjetivoChip | null // só campanhas têm chip de objetivo
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  resultadoHeroi: number
}

function statusAtivo(effectiveStatus: string | null): boolean | null {
  if (!effectiveStatus) return null
  return effectiveStatus === 'ACTIVE'
}

// Rótulo pt-BR + tom do effective_status da Meta (fix 17/jul/2026 — coluna
// Status do detalhamento). Reprovada = destaque vermelho.
function rotuloStatus(s: string): { label: string; tom: 'verde' | 'cinza' | 'vermelho' | 'ambar' } {
  switch (s) {
    case 'ACTIVE':
      return { label: 'Ativa', tom: 'verde' }
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return { label: 'Pausada', tom: 'cinza' }
    case 'DISAPPROVED':
      return { label: 'Reprovada', tom: 'vermelho' }
    case 'WITH_ISSUES':
      return { label: 'Com problemas', tom: 'vermelho' }
    case 'PENDING_REVIEW':
    case 'IN_PROCESS':
      return { label: 'Em análise', tom: 'ambar' }
    case 'ARCHIVED':
    case 'DELETED':
      return { label: 'Arquivada', tom: 'cinza' }
    default:
      return { label: s, tom: 'cinza' }
  }
}

const TOM_BADGE: Record<'verde' | 'cinza' | 'vermelho' | 'ambar', string> = {
  verde: 'border-chart-success/30 bg-chart-success/10 text-chart-success',
  cinza: 'border-border bg-muted text-muted-foreground',
  vermelho: 'border-destructive/30 bg-destructive/10 text-destructive',
  ambar: 'border-chart-warning/30 bg-chart-warning/10 text-chart-warning',
}

const TOM_DOT: Record<'verde' | 'cinza' | 'vermelho' | 'ambar', string> = {
  verde: 'bg-chart-success',
  cinza: 'bg-muted-foreground/50',
  vermelho: 'bg-destructive',
  ambar: 'bg-chart-warning',
}

type TabelaNiveisProps = {
  campanhas: LinhaCampanha[]
  conjuntos: LinhaConjunto[]
  anuncios: LinhaAnuncio[]
  labelHeroi: string
  /** Metas efetivas do semáforo (resolvidas no server) — opcional. */
  metas?: Record<string, MetaMetrica>
  /** Só campanhas (Google Ads ainda não alimenta Conjuntos/Anúncios): oculta as
   *  abas Conjuntos e Anúncios, travando a tabela no nível campanhas. */
  soloCampanhas?: boolean
}

export function TabelaNiveis({ campanhas, conjuntos, anuncios, labelHeroi, metas, soloCampanhas }: TabelaNiveisProps) {
  const [nivel, setNivel] = useState<Nivel>('campanhas')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  // Chips de objetivo ligados (vazio = sem filtro). Campanha SEM objetivo aparece sempre.
  const [objetivosAtivos, setObjetivosAtivos] = useState<Set<ObjetivoChip>>(new Set())

  // Um chip por objetivo distinto presente nas campanhas do cliente.
  const objetivosDisponiveis = useMemo(() => {
    const set = new Set<ObjetivoChip>()
    for (const c of campanhas) if (c.objetivo) set.add(c.objetivo)
    return Array.from(set).sort()
  }, [campanhas])

  function alternarObjetivo(obj: ObjetivoChip) {
    setObjetivosAtivos((atual) => {
      const novo = new Set(atual)
      if (novo.has(obj)) novo.delete(obj)
      else novo.add(obj)
      return novo
    })
  }

  const linhas: LinhaNormalizada[] = useMemo(() => {
    if (nivel === 'campanhas') {
      return campanhas.map((c) => ({
        id: c.campaignId,
        nome: c.campaignName,
        thumbnailUrl: null,
        temStatus: c.effectiveStatus !== null,
        ativo: statusAtivo(c.effectiveStatus),
        statusBruto: c.effectiveStatus,
        objetivo: c.objetivo,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        linkClicks: c.linkClicks,
        resultadoHeroi: c.resultadoHeroi,
      }))
    }
    if (nivel === 'conjuntos') {
      return conjuntos.map((c) => ({
        id: c.adsetId,
        nome: c.adsetName,
        thumbnailUrl: null,
        temStatus: false,
        ativo: null,
        statusBruto: null,
        objetivo: null,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        linkClicks: c.linkClicks,
        resultadoHeroi: c.resultadoHeroi,
      }))
    }
    return anuncios.map((a) => ({
      id: a.adId,
      nome: a.adName,
      thumbnailUrl: a.thumbnailUrl,
      temStatus: true,
      ativo: statusAtivo(a.effectiveStatus),
      statusBruto: a.effectiveStatus,
      objetivo: null,
      spend: a.spend,
      impressions: a.impressions,
      clicks: a.clicks,
      linkClicks: a.linkClicks,
      resultadoHeroi: a.resultadoHeroi,
    }))
  }, [nivel, campanhas, conjuntos, anuncios])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return linhas
      .filter((l) => (termo ? l.nome.toLowerCase().includes(termo) : true))
      .filter((l) => {
        if (filtroStatus === 'todos' || l.ativo === null) return true
        return filtroStatus === 'ativos' ? l.ativo : !l.ativo
      })
      .filter((l) => {
        // Filtro por objetivo só faz sentido no nível campanhas;
        // campanha SEM objetivo aparece sempre (nunca some por falta de dado).
        if (nivel !== 'campanhas' || objetivosAtivos.size === 0 || l.objetivo === null) return true
        return objetivosAtivos.has(l.objetivo)
      })
      .sort((a, b) => b.spend - a.spend)
  }, [linhas, busca, filtroStatus, nivel, objetivosAtivos])

  // Totais recalculados a partir das linhas FILTRADAS (soma + derivadas).
  const totais = useMemo(() => {
    const t = filtradas.reduce(
      (acc, l) => {
        acc.spend += l.spend
        acc.impressions += l.impressions
        acc.clicks += l.clicks
        acc.linkClicks += l.linkClicks
        acc.resultadoHeroi += l.resultadoHeroi
        return acc
      },
      { spend: 0, impressions: 0, clicks: 0, linkClicks: 0, resultadoHeroi: 0 },
    )
    return {
      ...t,
      cpc: t.clicks > 0 ? t.spend / t.clicks : null,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null,
      cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
      custoPorResultado: t.resultadoHeroi > 0 ? t.spend / t.resultadoHeroi : null,
    }
  }, [filtradas])

  function derivadas(l: LinhaNormalizada) {
    return {
      cpc: l.clicks > 0 ? l.spend / l.clicks : null,
      ctr: l.impressions > 0 ? (l.clicks / l.impressions) * 100 : null,
      cpm: l.impressions > 0 ? (l.spend / l.impressions) * 1000 : null,
      custoPorResultado: l.resultadoHeroi > 0 ? l.spend / l.resultadoHeroi : null,
    }
  }

  // Campanhas agora também têm effective_status (fix 17/jul/2026).
  const mostraStatus = nivel !== 'conjuntos'

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Detalhamento</CardTitle>
          <Tabs value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
            <TabsList>
              <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
              {!soloCampanhas && (
                <>
                  <TabsTrigger value="conjuntos">Conjuntos</TabsTrigger>
                  <TabsTrigger value="anuncios">Anúncios</TabsTrigger>
                </>
              )}
            </TabsList>
          </Tabs>
        </div>
        {/* Chips de filtro por objetivo (referência: imagem 4) — só no nível campanhas */}
        {nivel === 'campanhas' && objetivosDisponiveis.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrar por objetivo:</span>
            {objetivosDisponiveis.map((obj) => {
              const ligado = objetivosAtivos.has(obj)
              return (
                <button
                  key={obj}
                  type="button"
                  onClick={() => alternarObjetivo(obj)}
                  aria-pressed={ligado}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors',
                    ligado
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {obj}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-8"
            />
          </div>
          {mostraStatus && (
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as FiltroStatus)}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {nivel !== 'campanhas' && (
          <p className="text-xs text-muted-foreground">
            Conjuntos e anúncios refletem a janela dos últimos ~30 dias da sincronização com o
            Meta (o dado não vem diário), independente do período selecionado acima.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {filtradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {linhas.length === 0
              ? 'Sem dados neste nível para o período (sincronize para atualizar).'
              : 'Nenhum item corresponde à busca/filtro.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">{labelHeroi}</TableHead>
                  <TableHead className="text-right">Custo/result.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l) => {
                  const d = derivadas(l)
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {nivel === 'anuncios' &&
                            (l.thumbnailUrl ? (
                              <Image
                                src={l.thumbnailUrl}
                                alt=""
                                width={32}
                                height={32}
                                unoptimized
                                className="size-8 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                <ImageOff className="size-4 text-muted-foreground/60" />
                              </span>
                            ))}
                          <span className="max-w-[320px] truncate" title={l.nome}>
                            {l.nome}
                          </span>
                          {l.objetivo && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-border bg-muted/50 px-1.5 py-0 text-[10px] font-semibold text-muted-foreground"
                            >
                              {l.objetivo}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {l.statusBruto === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          // Badge VISUAL de status com dot colorido — nunca um switch de ação.
                          (() => {
                            const s = rotuloStatus(l.statusBruto)
                            return (
                              <Badge variant="outline" className={cn('gap-1.5', TOM_BADGE[s.tom])}>
                                <span className={cn('size-1.5 rounded-full', TOM_DOT[s.tom])} />
                                {s.label}
                              </Badge>
                            )
                          })()
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{moeda(l.spend)}</TableCell>
                      <TableCell className="text-right tabular-nums">{moeda(d.cpc)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.ctr === null ? '—' : `${formatadorPct.format(d.ctr)}%`}
                      </TableCell>
                      <TableCell className={cn('text-right tabular-nums', classeCelula('cpm', d.cpm, metas, l))}>
                        {moeda(d.cpm)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatadorNumero.format(l.impressions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatadorNumero.format(l.resultadoHeroi)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          classeCelula('custoPorResultado', d.custoPorResultado, metas, l),
                        )}
                      >
                        {moeda(d.custoPorResultado)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {/* Linha de TOTAIS dos itens filtrados */}
                <TableRow className="bg-muted/40 font-medium hover:bg-muted/40">
                  <TableCell>Totais ({filtradas.length})</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{moeda(totais.spend)}</TableCell>
                  <TableCell className="text-right tabular-nums">{moeda(totais.cpc)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totais.ctr === null ? '—' : `${formatadorPct.format(totais.ctr)}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{moeda(totais.cpm)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatadorNumero.format(totais.impressions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatadorNumero.format(totais.resultadoHeroi)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {moeda(totais.custoPorResultado)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
