// Regras DIÁRIAS de alerta por campanha/anúncio/conta (Feature 2 da spec de
// 17/jul/2026). Funções PURAS avaliam entradas preparadas; o orquestrador de
// I/O (getAlertasCampanhaDiarios) roda ~4 queries agregadas SEQUENCIAIS para
// todos os clientes de uma vez. Os alertas entram no MESMO ciclo de vida do
// motor persistido (chaveDedup = id → dedup, auto-resolução e reabertura de
// graça via avaliarEPersistirAlertas). Complementa — não substitui — os sinais
// existentes de saúde (fadiga, criativo rejeitado, quedas comparativas).

import { and, eq, gte, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights, clientes, preferenciasCampanhas } from '@/lib/db/schema'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'
import { classificarObjetivo, heroiDoObjetivo, type Nicho } from '@/lib/trafego/aggregate'
import { parseActionsExtendido } from '@/lib/trafego/metricas'
import { resolverMetas, type ItemComMeta, type MetaMetrica } from '@/lib/trafego/semaforo'
import type { Alerta } from './types'

// --- Thresholds da spec ---
/** Gasto no dia sem nenhum resultado a partir do qual vira alerta crítico. */
export const GASTO_SEM_RESULTADO_DIA = 50
/** Dias seguidos com custo/resultado acima da meta para alertar. */
export const DIAS_ACIMA_META = 3
/** CTR link mínimo (%) e impressões mínimas do alerta de anúncio fraco. */
export const CTR_MINIMO = 1
export const CTR_MIN_IMPRESSOES = 1500
/** Fator do gasto do dia sobre a média dos 7 anteriores que vira pico. */
export const FATOR_PICO_GASTO = 2
/** Gasto mínimo do dia para o pico não disparar com valores irrisórios. */
export const PICO_GASTO_MINIMO = 30

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const moeda = (v: number) => fmtMoeda.format(v)

/** Linha diária de campanha já parseada (insumo puro). */
export type DiaCampanha = {
  campaignId: string
  campaignName: string
  date: string // YYYY-MM-DD
  spend: number
  impressions: number
  resultadoHeroi: number
}

export type EntradaRegrasCliente = {
  clienteId: string
  clienteNome: string
  labelHeroi: string
  /** Meta de custo/resultado do semáforo (Feature 1); null = sem meta. */
  metaCusto: MetaMetrica | null
  /** Dias por campanha, TODOS os dias com linha nos últimos ~8 dias. */
  dias: DiaCampanha[]
  /** Anúncios (janela ~30d, dedupe pela mais recente) para o ctr_baixo. */
  anuncios: Array<{ adId: string; adName: string; impressions: number; linkClicks: number }>
  /** Contas do cliente com status ≠ ativo. */
  contasComProblema: Array<{ nome: string; statusLabel: string }>
}

function alerta(
  id: string,
  tipo: Alerta['tipo'],
  severidade: Alerta['severidade'],
  titulo: string,
  detalhe: string,
  e: EntradaRegrasCliente,
  dataRelevante: string,
): Alerta {
  return {
    id,
    tipo,
    severidade,
    titulo,
    detalhe,
    clienteId: e.clienteId,
    clienteNome: e.clienteNome,
    dataRelevante,
  }
}

/**
 * FUNÇÃO PURA — todas as regras diárias de um cliente. `hoje` injetável para
 * teste. O "dia de referência" é o dia mais recente com QUALQUER linha (o sync
 * das 6h enxerga D-1; usar a data corrente geraria falso 'entrega_parada').
 */
export function avaliarRegrasDiarias(e: EntradaRegrasCliente, hoje: string): Alerta[] {
  const alertas: Alerta[] = []

  // 7. Conta com problema (status ≠ ACTIVE no sync) — crítico.
  for (const conta of e.contasComProblema) {
    alertas.push(
      alerta(
        `campanha-conta-problema-${conta.nome}-${e.clienteId}`,
        'conta_com_problema',
        'critico',
        'Conta de anúncio com problema',
        `Conta "${conta.nome}" com status ${conta.statusLabel}. Verificar pagamento/bloqueio na Meta.`,
        e,
        hoje,
      ),
    )
  }

  if (e.dias.length === 0) {
    // Sem dado diário: ainda avalia o ctr_baixo (janela própria de ~30d).
    alertas.push(...avaliarCtrBaixo(e, hoje))
    return alertas
  }

  const diaRef = e.dias.reduce((max, d) => (d.date > max ? d.date : max), e.dias[0].date)
  const porCampanha = new Map<string, DiaCampanha[]>()
  for (const d of e.dias) {
    const lista = porCampanha.get(d.campaignId)
    if (lista) lista.push(d)
    else porCampanha.set(d.campaignId, [d])
  }

  let gastoDiaRefCliente = 0
  const gastoPorDiaAnterior = new Map<string, number>()

  for (const [campaignId, diasCamp] of porCampanha) {
    const ordenados = [...diasCamp].sort((a, b) => b.date.localeCompare(a.date))
    const doDiaRef = ordenados.find((d) => d.date === diaRef)
    const nome = ordenados[0].campaignName

    if (doDiaRef) gastoDiaRefCliente += doDiaRef.spend
    for (const d of ordenados) {
      if (d.date < diaRef) {
        gastoPorDiaAnterior.set(d.date, (gastoPorDiaAnterior.get(d.date) ?? 0) + d.spend)
      }
    }

    // 1. Gastou no dia e zero resultado — crítico.
    if (doDiaRef && doDiaRef.spend >= GASTO_SEM_RESULTADO_DIA && doDiaRef.resultadoHeroi === 0) {
      alertas.push(
        alerta(
          `campanha-gasto-sem-resultado-${campaignId}-${e.clienteId}`,
          'gasto_sem_resultado',
          'critico',
          'Gasto sem nenhum resultado no dia',
          `"${nome}" gastou ${moeda(doDiaRef.spend)} em ${diaRef} sem nenhum resultado (${e.labelHeroi.toLowerCase()}). Verificar: anúncio reprovado, pixel/formulário, página de destino.`,
          e,
          diaRef,
        ),
      )
    }

    // 2. Custo/resultado acima da meta (warn) por 3 dias seguidos.
    if (e.metaCusto) {
      const tresDias = ordenados.filter((d) => d.spend > 0).slice(0, DIAS_ACIMA_META)
      if (tresDias.length === DIAS_ACIMA_META) {
        const todosAcima = tresDias.every((d) => {
          const custo = d.resultadoHeroi > 0 ? d.spend / d.resultadoHeroi : Infinity
          return custo > e.metaCusto!.ruim
        })
        if (todosAcima) {
          const maisRecente = tresDias[0]
          const custoAtual =
            maisRecente.resultadoHeroi > 0 ? maisRecente.spend / maisRecente.resultadoHeroi : null
          alertas.push(
            alerta(
              `campanha-custo-acima-meta-${campaignId}-${e.clienteId}`,
              'custo_acima_meta',
              'atencao',
              'Custo por resultado acima da meta há 3 dias',
              `"${nome}" está com custo por resultado ${custoAtual !== null ? moeda(custoAtual) : 'sem resultado'}, acima da meta (${moeda(e.metaCusto.ruim)}) há ${DIAS_ACIMA_META} dias.`,
              e,
              diaRef,
            ),
          )
        }
      }
    }

    // 6. Entrega parou: 0 impressões no dia de referência com >0 no anterior.
    const diaAnterior = ordenados.find((d) => d.date < diaRef)
    const impressoesDiaRef = doDiaRef?.impressions ?? 0
    if (diaAnterior && diaAnterior.impressions > 0 && impressoesDiaRef === 0) {
      alertas.push(
        alerta(
          `campanha-entrega-parada-${campaignId}-${e.clienteId}`,
          'entrega_parada',
          'critico',
          'Campanha parou de entregar',
          `"${nome}" parou de entregar em ${diaRef} (tinha ${diaAnterior.impressions.toLocaleString('pt-BR')} impressões no dia anterior). Verificar reprovação, saldo ou limite.`,
          e,
          diaRef,
        ),
      )
    }
  }

  // 5. Pico de gasto do CLIENTE: dia de referência > 2x a média dos 7 anteriores.
  const anteriores = [...gastoPorDiaAnterior.values()]
  if (anteriores.length >= 3 && gastoDiaRefCliente >= PICO_GASTO_MINIMO) {
    const media = anteriores.reduce((a, b) => a + b, 0) / anteriores.length
    if (media > 0 && gastoDiaRefCliente > FATOR_PICO_GASTO * media) {
      alertas.push(
        alerta(
          `campanha-gasto-disparado-${e.clienteId}`,
          'gasto_disparado',
          'atencao',
          'Gasto do dia muito acima da média',
          `Gasto de ${e.clienteNome} saltou para ${moeda(gastoDiaRefCliente)} em ${diaRef} (média dos 7 dias anteriores: ${moeda(media)}).`,
          e,
          diaRef,
        ),
      )
    }
  }

  alertas.push(...avaliarCtrBaixo(e, hoje))
  return alertas
}

/** 3. FUNÇÃO PURA — anúncio com CTR link < 1% e volume: candidato a corte. */
function avaliarCtrBaixo(e: EntradaRegrasCliente, hoje: string): Alerta[] {
  const alertas: Alerta[] = []
  for (const a of e.anuncios) {
    if (a.impressions < CTR_MIN_IMPRESSOES) continue
    const ctr = (a.linkClicks / a.impressions) * 100
    if (ctr >= CTR_MINIMO) continue
    alertas.push(
      alerta(
        `campanha-ctr-baixo-${a.adId}-${e.clienteId}`,
        'ctr_baixo',
        'atencao',
        'Anúncio com CTR baixo — candidato a corte',
        `"${a.adName}" com CTR ${ctr.toFixed(2).replace('.', ',')}% e ${a.impressions.toLocaleString('pt-BR')} impressões.`,
        e,
        hoje,
      ),
    )
  }
  return alertas
}

/** Rótulo humano do account_status numérico da Meta. */
export function labelAccountStatus(status: number): string {
  switch (status) {
    case 1:
      return 'ATIVA'
    case 2:
      return 'DESATIVADA'
    case 3:
      return 'PENDÊNCIA DE PAGAMENTO'
    case 7:
      return 'EM ANÁLISE DE RISCO'
    case 9:
      return 'EM PERÍODO DE CARÊNCIA'
    case 101:
      return 'ENCERRADA'
    default:
      return `STATUS ${status}`
  }
}

// --- Orquestrador (I/O) ---

/**
 * Regras diárias de TODOS os clientes com contas Meta ativas em ~4 queries
 * agregadas SEQUENCIAIS (nunca por cliente). Nunca lança — [] em falha.
 */
export async function getAlertasCampanhaDiarios(): Promise<Alerta[]> {
  try {
    const hoje = hojeBrasilia()

    const contas = await db
      .select({
        id: adAccounts.id,
        nome: adAccounts.nome,
        clienteId: adAccounts.clienteId,
        accountStatus: adAccounts.accountStatus,
      })
      .from(adAccounts)
      // Google Ads mantido fora: alertas avaliam métricas contra metas; métricas Google ainda não validadas (PASSO B). Ver quick 260721-xa1.
      .where(and(eq(adAccounts.plataforma, 'meta'), eq(adAccounts.ativo, true)))
    const comCliente = contas.filter((c) => c.clienteId !== null)
    if (comCliente.length === 0) return []
    const contaParaCliente = new Map(comCliente.map((c) => [c.id, c.clienteId as string]))
    const clienteIds = [...new Set(contaParaCliente.values())]

    const infoClientes = await db
      .select({
        id: clientes.id,
        nome: clientes.nome,
        nicho: clientes.nicho,
        objetivoPrincipal: clientes.objetivoPrincipal,
      })
      .from(clientes)
      .where(inArray(clientes.id, clienteIds))

    const prefsRows = await db
      .select({ clienteId: preferenciasCampanhas.clienteId, kpis: preferenciasCampanhas.kpis })
      .from(preferenciasCampanhas)
      .where(inArray(preferenciasCampanhas.clienteId, clienteIds))
    const prefsPorCliente = new Map(prefsRows.map((r) => [r.clienteId, r.kpis as ItemComMeta[] | null]))

    const inicioJanela = dataMenosDias(8, hoje)
    const diasRows = await db
      .select({
        adAccountId: campaignInsights.adAccountId,
        campaignId: campaignInsights.campaignId,
        campaignName: campaignInsights.campaignName,
        date: campaignInsights.date,
        spend: campaignInsights.spend,
        impressions: campaignInsights.impressions,
        actions: campaignInsights.actions,
      })
      .from(campaignInsights)
      .where(
        and(
          inArray(campaignInsights.adAccountId, [...contaParaCliente.keys()]),
          gte(campaignInsights.date, inicioJanela),
        ),
      )

    // Anúncios (janela ~30d, mesma limitação/dedupe do painel).
    const adsRows = await db
      .select({
        adAccountId: adInsights.adAccountId,
        adId: adInsights.adId,
        adName: adInsights.adName,
        impressions: adInsights.impressions,
        actions: adInsights.actions,
        dateStop: adInsights.dateStop,
      })
      .from(adInsights)
      .where(inArray(adInsights.adAccountId, [...contaParaCliente.keys()]))
    const adMaisRecente = new Map<string, (typeof adsRows)[number]>()
    for (const row of adsRows) {
      const atual = adMaisRecente.get(row.adId)
      if (!atual || row.dateStop > atual.dateStop) adMaisRecente.set(row.adId, row)
    }

    const todos: Alerta[] = []
    for (const info of infoClientes) {
      const heroi = heroiDoObjetivo(info.objetivoPrincipal ?? null, (info.nicho ?? 'infoproduto') as Nicho)
      const classe = classificarObjetivo(info.objetivoPrincipal ?? null)
      const metas = resolverMetas(prefsPorCliente.get(info.id) ?? null, classe)
      const metaCusto =
        metas.get('custoPorResultado') ??
        metas.get('custoPorLead') ??
        metas.get('custoPorConversa') ??
        null

      const dias: DiaCampanha[] = []
      for (const d of diasRows) {
        if (contaParaCliente.get(d.adAccountId) !== info.id) continue
        const r = parseActionsExtendido(d.actions)
        const resultado =
          heroi.chave === 'vendas' ? r.vendas : heroi.chave === 'conversas' ? r.conversas : r.leads
        dias.push({
          campaignId: d.campaignId,
          campaignName: d.campaignName,
          date: d.date,
          spend: Number(d.spend) || 0,
          impressions: d.impressions ?? 0,
          resultadoHeroi: resultado,
        })
      }

      const anuncios = [...adMaisRecente.values()]
        .filter((a) => contaParaCliente.get(a.adAccountId) === info.id)
        .map((a) => ({
          adId: a.adId,
          adName: a.adName,
          impressions: a.impressions ?? 0,
          linkClicks: parseActionsExtendido(a.actions).linkClicks,
        }))

      const contasComProblema = comCliente
        .filter((c) => c.clienteId === info.id && c.accountStatus != null && c.accountStatus !== 1)
        .map((c) => ({ nome: c.nome, statusLabel: labelAccountStatus(c.accountStatus as number) }))

      todos.push(
        ...avaliarRegrasDiarias(
          {
            clienteId: info.id,
            clienteNome: info.nome,
            labelHeroi: heroi.label,
            metaCusto,
            dias,
            anuncios,
            contasComProblema,
          },
          hoje,
        ),
      )
    }
    return todos
  } catch (erro) {
    console.error('[regras-campanha] falha ao avaliar regras diárias — ignorando', erro)
    return []
  }
}
