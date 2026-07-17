// Semáforo de metas por métrica (Feature 1 da spec de 17/jul/2026) — módulo
// PURO (zero import de db/auth/react), no padrão de metricas.ts/presets-kpis.ts.
// Cada métrica visível ganha status verde/amarelo/vermelho/cinza comparando o
// valor do período com metas por cliente (salvas no MESMO jsonb `kpis` das
// preferências do Organizar — zero migration) ou com os defaults do objetivo.

import { CATALOGO_METRICAS, type MetricaId, type MetricasCalculadas } from './metricas'
import type { ClasseObjetivo } from './aggregate'

export type StatusMeta = 'bom' | 'atencao' | 'ruim' | 'sem_dados'

/** Meta de uma métrica: 'bom' = verde se melhor ou igual; 'ruim' = vermelho se pior. */
export type MetaMetrica = { bom: number; ruim: number }

/** Item de preferência como salvo no jsonb kpis (meta opcional, aditivo). */
export type ItemComMeta = {
  id: string
  ativo: boolean
  meta?: { bom: number; ruim: number; ativa: boolean } | null
}

// Amostra mínima para status confiável (spec): nunca marcar vermelho com
// amostra insignificante.
export const MIN_IMPRESSOES = 500
export const MIN_GASTO = 10
/** Gasto mínimo por LINHA da tabela de detalhamento para colorir célula. */
export const MIN_GASTO_LINHA = 20

const TIPO_POR_ID = new Map(CATALOGO_METRICAS.map((m) => [m.id, m.tipo]))

/** Direção da métrica: custo = menor melhor; volume/taxa = maior melhor. */
export function direcaoDaMetrica(id: MetricaId): 'menor' | 'maior' {
  return TIPO_POR_ID.get(id) === 'custo' ? 'menor' : 'maior'
}

/**
 * Defaults por classe de objetivo (tabela da spec, valores em BRL).
 * Aplicados quando o cliente não configurou meta própria para a métrica.
 */
export const METAS_PADRAO_POR_CLASSE: Record<ClasseObjetivo, Partial<Record<MetricaId, MetaMetrica>>> = {
  leads: {
    custoPorLead: { bom: 15, ruim: 20 },
    custoPorResultado: { bom: 15, ruim: 20 },
    ctrLink: { bom: 1.5, ruim: 1.0 },
    cpcLink: { bom: 1.5, ruim: 2.5 },
    cpm: { bom: 30, ruim: 40 },
  },
  conversas: {
    custoPorConversa: { bom: 10, ruim: 15 },
    custoPorResultado: { bom: 10, ruim: 15 },
    ctrLink: { bom: 1.5, ruim: 1.0 },
    cpcLink: { bom: 1.5, ruim: 2.5 },
    cpm: { bom: 30, ruim: 40 },
  },
  vendas: {
    roas: { bom: 3, ruim: 2 },
    ctrLink: { bom: 1.5, ruim: 1.0 },
    cpcLink: { bom: 1.5, ruim: 2.5 },
    cpm: { bom: 30, ruim: 40 },
  },
  trafego: {
    ctrLink: { bom: 1.5, ruim: 1.0 },
    cpcLink: { bom: 1.5, ruim: 2.5 },
    cpm: { bom: 30, ruim: 40 },
  },
  engajamento: {
    cpm: { bom: 30, ruim: 40 },
  },
}

/**
 * Resolve as metas efetivas do cliente: meta salva ATIVA no Organizar vence;
 * sem meta salva, entra o default da classe (se houver). Meta salva com
 * ativa=false desliga o semáforo daquela métrica (inclusive o default).
 */
export function resolverMetas(
  prefs: ItemComMeta[] | null,
  classe: ClasseObjetivo | null,
): Map<MetricaId, MetaMetrica> {
  const efetivas = new Map<MetricaId, MetaMetrica>()
  const padrao = classe ? METAS_PADRAO_POR_CLASSE[classe] : {}
  for (const [id, meta] of Object.entries(padrao)) {
    efetivas.set(id as MetricaId, meta)
  }
  for (const p of prefs ?? []) {
    if (!p.meta) continue
    if (!p.meta.ativa) {
      efetivas.delete(p.id as MetricaId)
      continue
    }
    if (Number.isFinite(p.meta.bom) && Number.isFinite(p.meta.ruim)) {
      efetivas.set(p.id as MetricaId, { bom: p.meta.bom, ruim: p.meta.ruim })
    }
  }
  return efetivas
}

/**
 * Status de UMA métrica frente à meta, com gate de amostra mínima:
 * impressões < 500 OU gasto < R$10 → 'sem_dados' (nunca vermelho com amostra
 * insignificante). Valor null (denominador zero) → 'sem_dados'.
 */
export function statusDaMetrica(
  id: MetricaId,
  valor: number | null,
  meta: MetaMetrica | undefined,
  amostra: { impressions: number; spend: number },
): StatusMeta | null {
  if (!meta) return null // métrica sem meta monitorada → sem chip (aparência atual)
  if (amostra.impressions < MIN_IMPRESSOES || amostra.spend < MIN_GASTO) return 'sem_dados'
  if (valor === null) return 'sem_dados'
  if (direcaoDaMetrica(id) === 'menor') {
    if (valor <= meta.bom) return 'bom'
    if (valor > meta.ruim) return 'ruim'
    return 'atencao'
  }
  if (valor >= meta.bom) return 'bom'
  if (valor < meta.ruim) return 'ruim'
  return 'atencao'
}

const ORDEM_PIOR: StatusMeta[] = ['ruim', 'atencao', 'bom', 'sem_dados']

/** Pior status entre vários (ruim > atenção > bom). 'sem_dados' só vence se for o único. */
export function piorStatus(statuses: StatusMeta[]): StatusMeta | null {
  if (statuses.length === 0) return null
  for (const s of ORDEM_PIOR) {
    if (s === 'sem_dados') continue
    if (statuses.includes(s)) return s
  }
  return 'sem_dados'
}

/** Linha mínima de campanha para o score (subset de LinhaCampanha do painel). */
export type CampanhaParaScore = {
  spend: number
  impressions: number
  linkClicks: number
  receita: number
  resultadoHeroi: number
}

/** Métricas da campanha que o semáforo monitora (derivadas das colunas somadas). */
export function metricasDaCampanha(c: CampanhaParaScore): Partial<Record<MetricaId, number | null>> {
  return {
    custoPorResultado: c.resultadoHeroi > 0 ? c.spend / c.resultadoHeroi : null,
    roas: c.receita > 0 && c.spend > 0 ? c.receita / c.spend : null,
    ctrLink: c.impressions > 0 ? (c.linkClicks / c.impressions) * 100 : null,
    cpcLink: c.linkClicks > 0 ? c.spend / c.linkClicks : null,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null,
  }
}

const PONTOS: Record<Exclude<StatusMeta, 'sem_dados'>, number> = {
  bom: 100,
  atencao: 60,
  ruim: 20,
}

export type ScoreSemaforo = {
  score: number
  rotulo: 'Saudável' | 'Atenção' | 'Crítico'
}

/**
 * Score de Saúde pelo semáforo (spec): verde=100, amarelo=60, vermelho=20,
 * média ponderada pelo GASTO de cada campanha. Cada campanha entra com a média
 * dos pontos das suas métricas monitoradas COM dado ('sem_dados' não pontua).
 * null quando nenhuma campanha tem métrica avaliável (quem chama usa fallback).
 */
export function scoreSemaforo(
  campanhas: CampanhaParaScore[],
  metas: Map<MetricaId, MetaMetrica>,
): ScoreSemaforo | null {
  if (metas.size === 0) return null
  let somaPesos = 0
  let somaPontos = 0
  for (const c of campanhas) {
    if (c.spend <= 0) continue
    const metricas = metricasDaCampanha(c)
    const pontos: number[] = []
    for (const [id, meta] of metas) {
      if (!(id in metricas)) continue
      const status = statusDaMetrica(id, metricas[id] ?? null, meta, {
        impressions: c.impressions,
        spend: c.spend,
      })
      if (status && status !== 'sem_dados') pontos.push(PONTOS[status])
    }
    if (pontos.length === 0) continue
    const media = pontos.reduce((a, b) => a + b, 0) / pontos.length
    somaPesos += c.spend
    somaPontos += media * c.spend
  }
  if (somaPesos === 0) return null
  const score = Math.round(somaPontos / somaPesos)
  const rotulo: ScoreSemaforo['rotulo'] = score >= 80 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico'
  return { score, rotulo }
}

/** Item do breakdown exibido no popover do Score de Saúde. */
export type ItemBreakdown = {
  id: MetricaId
  valor: number | null
  meta: MetaMetrica
  status: StatusMeta
}

/**
 * Breakdown do semáforo no NÍVEL DO CLIENTE (valores agregados do período):
 * uma linha por métrica monitorada, com valor, meta e status — explica o score.
 */
export function breakdownDoCliente(
  metricas: MetricasCalculadas,
  metas: Map<MetricaId, MetaMetrica>,
  amostra: { impressions: number; spend: number },
): ItemBreakdown[] {
  const itens: ItemBreakdown[] = []
  for (const [id, meta] of metas) {
    const status = statusDaMetrica(id, metricas[id] ?? null, meta, amostra)
    if (!status) continue
    itens.push({ id, valor: metricas[id] ?? null, meta, status })
  }
  const ordem: Record<StatusMeta, number> = { ruim: 0, atencao: 1, bom: 2, sem_dados: 3 }
  return itens.sort((a, b) => ordem[a.status] - ordem[b.status])
}
