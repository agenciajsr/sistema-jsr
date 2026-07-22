// Painel "Ações do dia" (Feature 3 da spec de 17/jul/2026): recomendações de
// CORTAR (anúncio), ESCALAR (campanha) e RENOVAR CRIATIVO (campanha), geradas
// dos dados já sincronizados. SOMENTE recomendação — o sistema continua
// somente-leitura na Meta. Núcleo PURO (testável) + orquestrador de I/O.

import { and, eq, gte, inArray, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, alertas, campaignInsights, clientes, preferenciasCampanhas } from '@/lib/db/schema'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'
import { classificarObjetivo, heroiDoObjetivo, type Nicho } from '@/lib/trafego/aggregate'
import { parseActionsExtendido } from '@/lib/trafego/metricas'
import { resolverMetas, type ItemComMeta, type MetaMetrica } from '@/lib/trafego/semaforo'

// --- Thresholds da spec ---
export const CORTAR_CTR_MAX = 1 // %
export const CORTAR_MIN_IMPRESSOES = 1500
export const CORTAR_FATOR_META = 1.5
export const CORTAR_MIN_GASTO = 50
export const ESCALAR_VARIACAO_MAX = 0.25
export const ESCALAR_FREQ_MAX = 3
export const ESCALAR_AUMENTO = 0.2
export const RENOVAR_FREQ_MIN = 3
export const RENOVAR_QUEDA_CTR = 0.3

export type TipoAcao = 'cortar' | 'escalar' | 'renovar'

export type AcaoDoDia = {
  tipo: TipoAcao
  /** Chave estável p/ "marcar como feito" (some até a condição disparar de novo). */
  chave: string
  entidade: 'anuncio' | 'campanha'
  entidadeId: string
  nome: string
  thumbnailUrl: string | null
  /** Métrica que disparou a regra, já formatada ("CTR 0,42%", "Custo R$ 32"). */
  motivo: string
  /** Recomendação em 1 frase. */
  recomendacao: string
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const moeda = (v: number) => fmtMoeda.format(v)
const pct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

export type AnuncioParaAcao = {
  adId: string
  adName: string
  thumbnailUrl: string | null
  spend: number
  impressions: number
  linkClicks: number
  resultadoHeroi: number
}

export type DiaCampanhaAcao = {
  campaignId: string
  campaignName: string
  date: string
  spend: number
  impressions: number
  reach: number
  linkClicks: number
  resultadoHeroi: number
}

export type EntradaAcoes = {
  metaCusto: MetaMetrica | null
  anuncios: AnuncioParaAcao[]
  /** Dias por campanha dos últimos 14 dias (7 atuais + 7 anteriores). */
  dias: DiaCampanhaAcao[]
  /** Campanhas com QUALQUER alerta ativo (bloqueiam a recomendação de escalar). */
  campanhasComAlerta: Set<string>
  /** true quando o cliente tem qualquer alerta ativo de campanha (fallback do bloqueio). */
  clienteTemAlerta: boolean
}

type ResumoCampanha = {
  campaignId: string
  campaignName: string
  spendAtual: number
  diasComGasto: number
  custoDiario: number[] // custo/resultado por dia (só dias com gasto e resultado>0 → número; sem resultado → Infinity)
  impressoesAtual: number
  reachAtual: number
  linkClicksAtual: number
  impressoesAnterior: number
  linkClicksAnterior: number
  resultadoAtual: number
}

/** FUNÇÃO PURA — as três listas de ações do dia. `hoje` injetável p/ teste. */
export function calcularAcoesDoDia(e: EntradaAcoes, hoje: string): AcaoDoDia[] {
  const acoes: AcaoDoDia[] = []

  // 🔴 CORTAR (nível anúncio)
  for (const a of e.anuncios) {
    const ctr = a.impressions > 0 ? (a.linkClicks / a.impressions) * 100 : null
    const custo = a.resultadoHeroi > 0 ? a.spend / a.resultadoHeroi : null

    if (ctr !== null && ctr < CORTAR_CTR_MAX && a.impressions >= CORTAR_MIN_IMPRESSOES) {
      acoes.push({
        tipo: 'cortar',
        chave: `cortar-ctr-${a.adId}`,
        entidade: 'anuncio',
        entidadeId: a.adId,
        nome: a.adName,
        thumbnailUrl: a.thumbnailUrl,
        motivo: `CTR ${pct(ctr)} com ${a.impressions.toLocaleString('pt-BR')} impressões`,
        recomendacao: 'CTR abaixo de 1% com volume relevante — candidato a corte.',
      })
      continue
    }
    if (
      e.metaCusto &&
      a.spend >= CORTAR_MIN_GASTO &&
      (custo === null || custo > e.metaCusto.bom * CORTAR_FATOR_META)
    ) {
      acoes.push({
        tipo: 'cortar',
        chave: `cortar-custo-${a.adId}`,
        entidade: 'anuncio',
        entidadeId: a.adId,
        nome: a.adName,
        thumbnailUrl: a.thumbnailUrl,
        motivo:
          custo === null
            ? `${moeda(a.spend)} gastos sem resultado`
            : `Custo/resultado ${moeda(custo)} (meta ${moeda(e.metaCusto.bom)})`,
        recomendacao: 'Custo por resultado acima de 1,5x a meta — candidato a corte.',
      })
    }
  }

  // Agregar os 14 dias por campanha em atual (7d) vs anterior (7d).
  const corte = dataMenosDias(6, hoje)
  const porCampanha = new Map<string, ResumoCampanha>()
  for (const d of e.dias) {
    let r = porCampanha.get(d.campaignId)
    if (!r) {
      r = {
        campaignId: d.campaignId,
        campaignName: d.campaignName,
        spendAtual: 0,
        diasComGasto: 0,
        custoDiario: [],
        impressoesAtual: 0,
        reachAtual: 0,
        linkClicksAtual: 0,
        impressoesAnterior: 0,
        linkClicksAnterior: 0,
        resultadoAtual: 0,
      }
      porCampanha.set(d.campaignId, r)
    }
    if (d.date >= corte) {
      r.spendAtual += d.spend
      r.impressoesAtual += d.impressions
      r.reachAtual += d.reach
      r.linkClicksAtual += d.linkClicks
      r.resultadoAtual += d.resultadoHeroi
      if (d.spend > 0) {
        r.diasComGasto += 1
        r.custoDiario.push(d.resultadoHeroi > 0 ? d.spend / d.resultadoHeroi : Infinity)
      }
    } else {
      r.impressoesAnterior += d.impressions
      r.linkClicksAnterior += d.linkClicks
    }
  }

  for (const r of porCampanha.values()) {
    if (r.spendAtual <= 0) continue
    const custoMedio = r.resultadoAtual > 0 ? r.spendAtual / r.resultadoAtual : null
    const freq = r.reachAtual > 0 ? r.impressoesAtual / r.reachAtual : null
    const ctrAtual = r.impressoesAtual > 0 ? (r.linkClicksAtual / r.impressoesAtual) * 100 : null
    const ctrAnterior =
      r.impressoesAnterior > 0 ? (r.linkClicksAnterior / r.impressoesAnterior) * 100 : null
    const dentroDaMeta =
      e.metaCusto !== null && custoMedio !== null && custoMedio <= e.metaCusto.ruim

    // Sinais de saturação avaliados ANTES do escalar: campanha saturando não
    // deve receber "aumente o orçamento" — renovar criativo tem prioridade.
    const freqAlta = freq !== null && freq > RENOVAR_FREQ_MIN
    const ctrCaindo =
      ctrAtual !== null &&
      ctrAnterior !== null &&
      ctrAnterior > 0 &&
      (ctrAnterior - ctrAtual) / ctrAnterior >= RENOVAR_QUEDA_CTR

    // 🟢 ESCALAR: custo ≤ meta boa, estável (<25% de variação), freq < 3, sem alerta.
    if (
      !freqAlta &&
      !ctrCaindo &&
      e.metaCusto &&
      custoMedio !== null &&
      custoMedio <= e.metaCusto.bom &&
      r.diasComGasto >= 5 &&
      r.custoDiario.every((c) => Number.isFinite(c)) &&
      (freq === null || freq < ESCALAR_FREQ_MAX) &&
      !e.campanhasComAlerta.has(r.campaignId)
    ) {
      const min = Math.min(...r.custoDiario)
      const max = Math.max(...r.custoDiario)
      const media = r.custoDiario.reduce((a, b) => a + b, 0) / r.custoDiario.length
      const variacao = media > 0 ? (max - min) / media : Infinity
      if (variacao < ESCALAR_VARIACAO_MAX * 2) {
        // variação total (max-min) < 50% ≈ desvio de ±25% da média
        const gastoDiario = r.spendAtual / r.diasComGasto
        const sugerido = gastoDiario * (1 + ESCALAR_AUMENTO)
        acoes.push({
          tipo: 'escalar',
          chave: `escalar-${r.campaignId}`,
          entidade: 'campanha',
          entidadeId: r.campaignId,
          nome: r.campaignName,
          thumbnailUrl: null,
          motivo: `Custo/resultado ${moeda(custoMedio)} estável há 7 dias (meta ${moeda(e.metaCusto.bom)})`,
          recomendacao: `Aumentar orçamento em até 20% (${moeda(gastoDiario)}/dia → ${moeda(sugerido)}/dia). Aguardar 3-4 dias antes do próximo aumento.`,
        })
        continue
      }
    }

    // 🟡 RENOVAR CRIATIVO: freq > 3 OU CTR caindo ≥30% — com resultado ainda na meta.
    if ((freqAlta || ctrCaindo) && (e.metaCusto === null || dentroDaMeta)) {
      acoes.push({
        tipo: 'renovar',
        chave: `renovar-${r.campaignId}`,
        entidade: 'campanha',
        entidadeId: r.campaignId,
        nome: r.campaignName,
        thumbnailUrl: null,
        motivo: freqAlta
          ? `Frequência ${(freq ?? 0).toFixed(1).replace('.', ',')} nos últimos 7 dias`
          : `CTR caiu de ${pct(ctrAnterior ?? 0)} para ${pct(ctrAtual ?? 0)} (7d vs 7d)`,
        recomendacao:
          'Performance boa mas público saturando — subir variações novas do ângulo vencedor.',
      })
    }
  }

  return acoes
}

// --- Orquestrador (I/O) ---

/**
 * Ações do dia de UM cliente (~4 queries agregadas SEQUENCIAIS). Nunca lança —
 * [] em qualquer falha (o painel esconde a seção).
 */
export async function getAcoesDoDia(clienteId: string): Promise<AcaoDoDia[]> {
  try {
    const hoje = hojeBrasilia()

    const cliente = await db.query.clientes.findFirst({
      where: eq(clientes.id, clienteId),
      columns: { nicho: true, objetivoPrincipal: true },
    })
    if (!cliente) return []
    const heroi = heroiDoObjetivo(cliente.objetivoPrincipal ?? null, (cliente.nicho ?? 'infoproduto') as Nicho)

    const contas = await db
      .select({ id: adAccounts.id })
      .from(adAccounts)
      .where(and(eq(adAccounts.clienteId, clienteId), eq(adAccounts.ativo, true)))
    if (contas.length === 0) return []
    const contaIds = contas.map((c) => c.id)

    const prefsRows = await db
      .select({ kpis: preferenciasCampanhas.kpis })
      .from(preferenciasCampanhas)
      .where(eq(preferenciasCampanhas.clienteId, clienteId))
    const metas = resolverMetas(
      (prefsRows[0]?.kpis as ItemComMeta[] | null) ?? null,
      classificarObjetivo(cliente.objetivoPrincipal ?? null),
    )
    const metaCusto =
      metas.get('custoPorResultado') ?? metas.get('custoPorLead') ?? metas.get('custoPorConversa') ?? null

    const inicio = dataMenosDias(13, hoje)
    const diasRows = await db
      .select({
        campaignId: campaignInsights.campaignId,
        campaignName: campaignInsights.campaignName,
        date: campaignInsights.date,
        spend: campaignInsights.spend,
        impressions: campaignInsights.impressions,
        reach: campaignInsights.reach,
        actions: campaignInsights.actions,
        effectiveStatus: campaignInsights.effectiveStatus,
      })
      .from(campaignInsights)
      .where(and(inArray(campaignInsights.adAccountId, contaIds), gte(campaignInsights.date, inicio)))

    // Só campanhas NÃO pausadas entram nas recomendações (quando o status existe).
    const pausadas = new Set(
      diasRows.filter((d) => d.effectiveStatus && d.effectiveStatus !== 'ACTIVE').map((d) => d.campaignId),
    )

    const dias: DiaCampanhaAcao[] = diasRows
      .filter((d) => !pausadas.has(d.campaignId))
      .map((d) => {
        const r = parseActionsExtendido(d.actions)
        return {
          campaignId: d.campaignId,
          campaignName: d.campaignName,
          date: d.date,
          spend: Number(d.spend) || 0,
          impressions: d.impressions ?? 0,
          reach: d.reach ?? 0,
          linkClicks: r.linkClicks,
          resultadoHeroi:
            heroi.chave === 'vendas' ? r.vendas : heroi.chave === 'conversas' ? r.conversas : r.leads,
        }
      })

    const adsRows = await db
      .select({
        adId: adInsights.adId,
        adName: adInsights.adName,
        thumbnailUrl: adInsights.thumbnailUrl,
        effectiveStatus: adInsights.effectiveStatus,
        spend: adInsights.spend,
        impressions: adInsights.impressions,
        actions: adInsights.actions,
        dateStop: adInsights.dateStop,
      })
      .from(adInsights)
      .where(inArray(adInsights.adAccountId, contaIds))
    const maisRecente = new Map<string, (typeof adsRows)[number]>()
    for (const row of adsRows) {
      const atual = maisRecente.get(row.adId)
      if (!atual || row.dateStop > atual.dateStop) maisRecente.set(row.adId, row)
    }
    const anuncios: AnuncioParaAcao[] = [...maisRecente.values()]
      .filter((a) => !a.effectiveStatus || a.effectiveStatus === 'ACTIVE')
      .map((a) => {
        const r = parseActionsExtendido(a.actions)
        return {
          adId: a.adId,
          adName: a.adName,
          thumbnailUrl: a.thumbnailUrl,
          spend: Number(a.spend) || 0,
          impressions: a.impressions ?? 0,
          linkClicks: r.linkClicks,
          resultadoHeroi:
            heroi.chave === 'vendas' ? r.vendas : heroi.chave === 'conversas' ? r.conversas : r.leads,
        }
      })

    // Campanhas com alerta ativo (bloqueio do escalar): a chaveDedup dos alertas
    // diários embute o campaignId — basta procurar o id na chave.
    const alertasAtivos = await db
      .select({ chaveDedup: alertas.chaveDedup })
      .from(alertas)
      .where(and(eq(alertas.clienteId, clienteId), ne(alertas.status, 'resolvido')))
    const campanhasComAlerta = new Set<string>()
    for (const a of alertasAtivos) {
      for (const c of new Set(dias.map((d) => d.campaignId))) {
        if (a.chaveDedup.includes(c)) campanhasComAlerta.add(c)
      }
    }

    return calcularAcoesDoDia(
      { metaCusto, anuncios, dias, campanhasComAlerta, clienteTemAlerta: alertasAtivos.length > 0 },
      hoje,
    )
  } catch (erro) {
    console.error('[acoes-dia] falha ao calcular — seção fica vazia', erro)
    return []
  }
}
