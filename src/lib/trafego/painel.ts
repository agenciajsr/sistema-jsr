// Fonte de dados do painel /campanhas redesenhado: UMA passada com POUCAS
// queries agregadas SEQUENCIAIS (pool max=5, nunca Promise.all interno —
// decisão 260714-ita). getResumoCliente segue intacto para saúde/relatórios.

import { eq, and, gte, lte, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, adsetInsights, campaignInsights, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'
// parseActionsExtendido/parseActionValues vêm de ./aggregate (fonte única —
// aggregate reexporta a mecânica pura de ./metricas)
import {
  heroiDoObjetivo,
  parseActionsExtendido,
  parseActionValues,
  type Heroi,
  type Nicho,
  type Periodo,
} from './aggregate'
import { totaisVazios, type TotaisPeriodo } from './metricas'

/** Ponto da série diária, já quebrado por campanha (o gráfico agrega client-side). */
export type PontoSerie = {
  date: string // 'YYYY-MM-DD'
  campaignId: string
  campaignName: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  leads: number
  vendas: number
  conversas: number
  linkClicks: number
  adicoesCarrinho: number
  visualizacoesLp: number
  engajamento: number
  receita: number
}

export type LinhaCampanha = {
  campaignId: string
  campaignName: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  leads: number
  vendas: number
  conversas: number
  linkClicks: number
  adicoesCarrinho: number
  visualizacoesLp: number
  engajamento: number
  receita: number
  resultadoHeroi: number
}

export type LinhaConjunto = {
  adsetId: string
  adsetName: string
  campaignName: string | null
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  resultadoHeroi: number
}

export type LinhaAnuncio = {
  adId: string
  adName: string
  adsetName: string | null
  campaignName: string | null
  thumbnailUrl: string | null
  effectiveStatus: string | null
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  resultadoHeroi: number
}

export type PainelCampanhas = {
  clienteId: string
  contasUnificadas: number
  heroi: Heroi
  totaisAtual: TotaisPeriodo
  totaisAnterior: TotaisPeriodo
  seriePorDia: PontoSerie[]
  campanhas: LinhaCampanha[]
  conjuntos: LinhaConjunto[]
  anuncios: LinhaAnuncio[]
  temDados: boolean
}

function painelVazio(clienteId: string, heroi: Heroi, contas: number): PainelCampanhas {
  return {
    clienteId,
    contasUnificadas: contas,
    heroi,
    totaisAtual: totaisVazios(),
    totaisAnterior: totaisVazios(),
    seriePorDia: [],
    campanhas: [],
    conjuntos: [],
    anuncios: [],
    temDados: false,
  }
}

/**
 * Janelas do período ATUAL e do ANTERIOR equivalente (mesma largura, deslocada):
 * hoje -> ontem, ontem -> anteontem, 7d -> 7d anteriores, 30d -> 30d anteriores.
 * Intervalos FECHADOS 'YYYY-MM-DD' no fuso de Brasília.
 */
export function janelasDoPeriodo(periodo: Periodo, hoje: string = hojeBrasilia()) {
  switch (periodo) {
    case 'hoje':
      return {
        inicioAtual: hoje,
        fimAtual: hoje,
        inicioAnterior: dataMenosDias(1, hoje),
        fimAnterior: dataMenosDias(1, hoje),
      }
    case 'ontem':
      return {
        inicioAtual: dataMenosDias(1, hoje),
        fimAtual: dataMenosDias(1, hoje),
        inicioAnterior: dataMenosDias(2, hoje),
        fimAnterior: dataMenosDias(2, hoje),
      }
    case '7d':
      return {
        inicioAtual: dataMenosDias(6, hoje),
        fimAtual: hoje,
        inicioAnterior: dataMenosDias(13, hoje),
        fimAnterior: dataMenosDias(7, hoje),
      }
    case '30d':
    default:
      return {
        inicioAtual: dataMenosDias(29, hoje),
        fimAtual: hoje,
        inicioAnterior: dataMenosDias(59, hoje),
        fimAnterior: dataMenosDias(30, hoje),
      }
  }
}

function somarNoTotal(t: TotaisPeriodo, spend: number, impressions: number, clicks: number, reach: number, r: ReturnType<typeof parseActionsExtendido>, receita: number) {
  t.spend += spend
  t.impressions += impressions
  t.clicks += clicks
  t.reach += reach
  t.leads += r.leads
  t.vendas += r.vendas
  t.conversas += r.conversas
  t.linkClicks += r.linkClicks
  t.adicoesCarrinho += r.adicoesCarrinho
  t.visualizacoesLp += r.visualizacoesLp
  t.engajamento += r.engajamento
  t.receita += receita
}

function resultadoDaChave(r: { leads: number; vendas: number; conversas: number }, chave: Heroi['chave']): number {
  if (chave === 'vendas') return r.vendas
  if (chave === 'conversas') return r.conversas
  return r.leads
}

/**
 * Agrega TODOS os dados do painel de campanhas de um cliente num só retorno:
 * totais do período atual + anterior equivalente (Comparar), série diária por
 * campanha (gráfico Performance), agregados por campanha/conjunto/anúncio
 * (tabela por nível + funil). ~3-5 queries agregadas SEQUENCIAIS.
 * Nunca lança: sem sessão -> null; sem contas/dados -> painel zerado.
 */
export async function getPainelCampanhas(
  clienteId: string,
  periodo: Periodo = '30d',
): Promise<PainelCampanhas | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, clienteId),
    columns: { id: true, nicho: true, objetivoPrincipal: true },
  })
  const heroi = heroiDoObjetivo(
    cliente?.objetivoPrincipal ?? null,
    (cliente?.nicho ?? 'infoproduto') as Nicho,
  )
  if (!cliente) return painelVazio(clienteId, heroi, 0)

  const contas = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
        eq(adAccounts.plataforma, 'meta'),
        eq(adAccounts.ativo, true),
      ),
    )
  if (contas.length === 0) return painelVazio(clienteId, heroi, 0)
  const contaIds = contas.map((c) => c.id)

  const { inicioAtual, fimAtual, inicioAnterior } = janelasDoPeriodo(periodo)

  // Query A: campaignInsights do período ATUAL + ANTERIOR numa única query,
  // separando em memória pela data de cada linha.
  const insights = await db
    .select({
      campaignId: campaignInsights.campaignId,
      campaignName: campaignInsights.campaignName,
      date: campaignInsights.date,
      spend: campaignInsights.spend,
      impressions: campaignInsights.impressions,
      clicks: campaignInsights.clicks,
      reach: campaignInsights.reach,
      actions: campaignInsights.actions,
      actionValues: campaignInsights.actionValues,
    })
    .from(campaignInsights)
    .where(
      and(
        inArray(campaignInsights.adAccountId, contaIds),
        gte(campaignInsights.date, inicioAnterior),
        lte(campaignInsights.date, fimAtual),
      ),
    )

  const totaisAtual = totaisVazios()
  const totaisAnterior = totaisVazios()
  const porDiaCampanha = new Map<string, PontoSerie>()
  const porCampanha = new Map<string, LinhaCampanha>()

  for (const i of insights) {
    const spend = Number(i.spend) || 0
    const impressions = i.impressions ?? 0
    const clicks = i.clicks ?? 0
    const reach = i.reach ?? 0
    const r = parseActionsExtendido(i.actions)
    const receita = parseActionValues(i.actionValues)
    const ehAtual = i.date >= inicioAtual

    somarNoTotal(ehAtual ? totaisAtual : totaisAnterior, spend, impressions, clicks, reach, r, receita)

    if (!ehAtual) continue // série e níveis mostram só o período ATUAL

    const chaveSerie = `${i.date}|${i.campaignId}`
    const ponto = porDiaCampanha.get(chaveSerie)
    if (ponto) {
      ponto.spend += spend
      ponto.impressions += impressions
      ponto.clicks += clicks
      ponto.reach += reach
      ponto.leads += r.leads
      ponto.vendas += r.vendas
      ponto.conversas += r.conversas
      ponto.linkClicks += r.linkClicks
      ponto.adicoesCarrinho += r.adicoesCarrinho
      ponto.visualizacoesLp += r.visualizacoesLp
      ponto.engajamento += r.engajamento
      ponto.receita += receita
    } else {
      porDiaCampanha.set(chaveSerie, {
        date: i.date,
        campaignId: i.campaignId,
        campaignName: i.campaignName,
        spend,
        impressions,
        clicks,
        reach,
        leads: r.leads,
        vendas: r.vendas,
        conversas: r.conversas,
        linkClicks: r.linkClicks,
        adicoesCarrinho: r.adicoesCarrinho,
        visualizacoesLp: r.visualizacoesLp,
        engajamento: r.engajamento,
        receita,
      })
    }

    const camp = porCampanha.get(i.campaignId)
    if (camp) {
      camp.spend += spend
      camp.impressions += impressions
      camp.clicks += clicks
      camp.reach += reach
      camp.leads += r.leads
      camp.vendas += r.vendas
      camp.conversas += r.conversas
      camp.linkClicks += r.linkClicks
      camp.adicoesCarrinho += r.adicoesCarrinho
      camp.visualizacoesLp += r.visualizacoesLp
      camp.engajamento += r.engajamento
      camp.receita += receita
      camp.resultadoHeroi += resultadoDaChave(r, heroi.chave)
    } else {
      porCampanha.set(i.campaignId, {
        campaignId: i.campaignId,
        campaignName: i.campaignName,
        spend,
        impressions,
        clicks,
        reach,
        leads: r.leads,
        vendas: r.vendas,
        conversas: r.conversas,
        linkClicks: r.linkClicks,
        adicoesCarrinho: r.adicoesCarrinho,
        visualizacoesLp: r.visualizacoesLp,
        engajamento: r.engajamento,
        receita,
        resultadoHeroi: resultadoDaChave(r, heroi.chave),
      })
    }
  }

  totaisAtual.resultadoHeroi = resultadoDaChave(totaisAtual, heroi.chave)
  totaisAnterior.resultadoHeroi = resultadoDaChave(totaisAnterior, heroi.chave)

  // Query B: adsetInsights do período ATUAL (nível conjuntos).
  // Degradação graciosa: tabela ausente/erro -> nível vazio, painel segue vivo.
  const porConjunto = new Map<string, LinhaConjunto>()
  try {
    const adsetRows = await db
      .select({
        adsetId: adsetInsights.adsetId,
        adsetName: adsetInsights.adsetName,
        campaignName: adsetInsights.campaignName,
        spend: adsetInsights.spend,
        impressions: adsetInsights.impressions,
        clicks: adsetInsights.clicks,
        actions: adsetInsights.actions,
      })
      .from(adsetInsights)
      .where(
        and(
          inArray(adsetInsights.adAccountId, contaIds),
          gte(adsetInsights.dateStart, inicioAtual),
          lte(adsetInsights.dateStart, fimAtual),
        ),
      )
    for (const row of adsetRows) {
      const spend = Number(row.spend) || 0
      const r = parseActionsExtendido(row.actions)
      const resultado = resultadoDaChave(r, heroi.chave)
      const exist = porConjunto.get(row.adsetId)
      if (exist) {
        exist.spend += spend
        exist.impressions += row.impressions ?? 0
        exist.clicks += row.clicks ?? 0
        exist.linkClicks += r.linkClicks
        exist.resultadoHeroi += resultado
      } else {
        porConjunto.set(row.adsetId, {
          adsetId: row.adsetId,
          adsetName: row.adsetName,
          campaignName: row.campaignName,
          spend,
          impressions: row.impressions ?? 0,
          clicks: row.clicks ?? 0,
          linkClicks: r.linkClicks,
          resultadoHeroi: resultado,
        })
      }
    }
  } catch {
    // adset_insights pode não existir ainda — nível conjuntos fica vazio
  }

  // Query C: adInsights do período ATUAL (nível anúncios, com thumbnail/status).
  const porAnuncio = new Map<string, LinhaAnuncio>()
  try {
    const adRows = await db
      .select({
        adId: adInsights.adId,
        adName: adInsights.adName,
        adsetName: adInsights.adsetName,
        campaignName: adInsights.campaignName,
        thumbnailUrl: adInsights.thumbnailUrl,
        effectiveStatus: adInsights.effectiveStatus,
        spend: adInsights.spend,
        impressions: adInsights.impressions,
        clicks: adInsights.clicks,
        actions: adInsights.actions,
      })
      .from(adInsights)
      .where(
        and(
          inArray(adInsights.adAccountId, contaIds),
          gte(adInsights.dateStart, inicioAtual),
          lte(adInsights.dateStart, fimAtual),
        ),
      )
    for (const row of adRows) {
      const spend = Number(row.spend) || 0
      const r = parseActionsExtendido(row.actions)
      const resultado = resultadoDaChave(r, heroi.chave)
      const exist = porAnuncio.get(row.adId)
      if (exist) {
        exist.spend += spend
        exist.impressions += row.impressions ?? 0
        exist.clicks += row.clicks ?? 0
        exist.linkClicks += r.linkClicks
        exist.resultadoHeroi += resultado
        if (!exist.thumbnailUrl && row.thumbnailUrl) exist.thumbnailUrl = row.thumbnailUrl
        if (!exist.effectiveStatus && row.effectiveStatus) exist.effectiveStatus = row.effectiveStatus
      } else {
        porAnuncio.set(row.adId, {
          adId: row.adId,
          adName: row.adName,
          adsetName: row.adsetName,
          campaignName: row.campaignName,
          thumbnailUrl: row.thumbnailUrl,
          effectiveStatus: row.effectiveStatus,
          spend,
          impressions: row.impressions ?? 0,
          clicks: row.clicks ?? 0,
          linkClicks: r.linkClicks,
          resultadoHeroi: resultado,
        })
      }
    }
  } catch {
    // ad_insights pode não existir ainda — nível anúncios fica vazio
  }

  const seriePorDia = Array.from(porDiaCampanha.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.campaignName.localeCompare(b.campaignName),
  )
  const campanhas = Array.from(porCampanha.values()).sort((a, b) => b.spend - a.spend)
  const conjuntos = Array.from(porConjunto.values()).sort((a, b) => b.spend - a.spend)
  const anuncios = Array.from(porAnuncio.values()).sort((a, b) => b.spend - a.spend)

  return {
    clienteId,
    contasUnificadas: contas.length,
    heroi,
    totaisAtual,
    totaisAnterior,
    seriePorDia,
    campanhas,
    conjuntos,
    anuncios,
    temDados: totaisAtual.spend > 0 || totaisAtual.impressions > 0 || campanhas.length > 0,
  }
}
