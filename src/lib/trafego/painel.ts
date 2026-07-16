// Fonte de dados do painel /campanhas redesenhado: UMA passada com POUCAS
// queries agregadas SEQUENCIAIS (pool max=5, nunca Promise.all interno —
// decisão 260714-ita). getResumoCliente segue intacto para saúde/relatórios.

import { eq, and, gte, lte, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, campaignInsights, clientes, demografiaInsights, regiaoInsights } from '@/lib/db/schema'
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
import {
  agregarDemografia,
  rankingDeRegioes,
  campanhasComRegiao,
  deduplicarJanelaMaisRecente,
  objetivoDaCampanha,
  type LinhaDemografia,
  type LinhaRegiao,
  type MetricaRegiao,
  type MotivoRegiao,
  type ObjetivoChip,
  type RankingRegioes,
} from './demografia'

export type {
  LinhaDemografia,
  LinhaRegiao,
  ObjetivoChip,
  MetricaRegiao,
  MotivoRegiao,
  RankingRegioes,
}

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
  // Chip de objetivo: objective OFICIAL da Meta quando existe; senão fallback
  // classificarObjetivo (objetivo cadastrado do cliente); null quando nada resolve.
  objetivo: ObjetivoChip | null
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
  // Demografia/regiões refletem a janela ~30d do Meta independente do período
  // selecionado (mesma limitação aceita dos anúncios — a UI avisa).
  demografia: LinhaDemografia[]
  regioes: RankingRegioes
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
    demografia: [],
    regioes: { metrica: 'heroi', motivo: 'heroi', linhas: [] },
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
      objective: campaignInsights.objective,
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
  // objective OFICIAL não-nulo mais recente por campanha (linhas antigas são null)
  const objectivePorCampanha = new Map<string, { objective: string; date: string }>()

  for (const i of insights) {
    if (i.objective) {
      const atual = objectivePorCampanha.get(i.campaignId)
      if (!atual || i.date > atual.date) {
        objectivePorCampanha.set(i.campaignId, { objective: i.objective, date: i.date })
      }
    }
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
        objetivo: null, // preenchido após o loop (objective mais recente por campanha)
      })
    }
  }

  // Chip de objetivo por campanha: objective oficial mais recente com fallback
  // para o classificarObjetivo do objetivo cadastrado do cliente.
  for (const camp of porCampanha.values()) {
    camp.objetivo = objetivoDaCampanha(
      objectivePorCampanha.get(camp.campaignId)?.objective ?? null,
      cliente.objetivoPrincipal ?? null,
    )
  }

  totaisAtual.resultadoHeroi = resultadoDaChave(totaisAtual, heroi.chave)
  totaisAnterior.resultadoHeroi = resultadoDaChave(totaisAnterior, heroi.chave)

  // Query B: adInsights — níveis conjuntos + anúncios.
  //
  // ⚠️ LIMITAÇÃO DO DADO (descoberta em 15/jul/2026): o sync grava ad_insights
  // como JANELA AGREGADA de ~30 dias (date_start≈hoje-30 → date_stop≈hoje), uma
  // janela nova por dia de sync — NÃO é série diária. Filtrar por
  // date_start dentro do período NUNCA bate (a janela começa antes) e somar
  // várias janelas conta o mesmo anúncio N vezes. O correto é usar SOMENTE a
  // janela mais recente de cada anúncio (dedupe por adId ficando com o maior
  // date_stop). Consequência aceita: estes dois níveis refletem os últimos
  // ~30 dias do Meta, independente do período selecionado (a UI avisa).
  // adset_insights está VAZIA desde sempre (sync nunca gravou) — conjuntos são
  // derivados agrupando os anúncios por adsetId, como o aggregate.ts antigo fazia.
  const porConjunto = new Map<string, LinhaConjunto>()
  const porAnuncio = new Map<string, LinhaAnuncio>()
  try {
    const adRows = await db
      .select({
        adId: adInsights.adId,
        adName: adInsights.adName,
        adsetId: adInsights.adsetId,
        adsetName: adInsights.adsetName,
        campaignName: adInsights.campaignName,
        thumbnailUrl: adInsights.thumbnailUrl,
        effectiveStatus: adInsights.effectiveStatus,
        spend: adInsights.spend,
        impressions: adInsights.impressions,
        clicks: adInsights.clicks,
        actions: adInsights.actions,
        dateStop: adInsights.dateStop,
      })
      .from(adInsights)
      .where(
        and(
          inArray(adInsights.adAccountId, contaIds),
          // Janela que ainda alcança o período pedido (roda diária, então na
          // prática pega as janelas dos últimos dias de sync).
          gte(adInsights.dateStop, inicioAtual),
        ),
      )

    // Dedupe: fica só a janela MAIS RECENTE de cada anúncio.
    const maisRecente = new Map<string, (typeof adRows)[number]>()
    for (const row of adRows) {
      const atual = maisRecente.get(row.adId)
      if (!atual || row.dateStop > atual.dateStop) maisRecente.set(row.adId, row)
    }

    for (const row of maisRecente.values()) {
      const spend = Number(row.spend) || 0
      const r = parseActionsExtendido(row.actions)
      const resultado = resultadoDaChave(r, heroi.chave)

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

      // Conjunto = soma dos anúncios do mesmo adset (janela mais recente).
      const adsetId = row.adsetId ?? 'sem-conjunto'
      const exist = porConjunto.get(adsetId)
      if (exist) {
        exist.spend += spend
        exist.impressions += row.impressions ?? 0
        exist.clicks += row.clicks ?? 0
        exist.linkClicks += r.linkClicks
        exist.resultadoHeroi += resultado
      } else {
        porConjunto.set(adsetId, {
          adsetId,
          adsetName: row.adsetName ?? 'Sem conjunto',
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
    // ad_insights pode não existir ainda — níveis conjuntos/anúncios ficam vazios
  }

  // Query C: demografia_insights (idade × gênero). Mesma natureza do ad_insights:
  // janela AGREGADA de ~30d, 1 janela nova por dia de sync — usar SEMPRE a janela
  // mais recente por (campaignId, age, gender). Reflete os últimos ~30 dias do
  // Meta independente do período selecionado (a UI avisa). Degradação graciosa.
  let demografia: LinhaDemografia[] = []
  try {
    const demoRows = await db
      .select({
        campaignId: demografiaInsights.campaignId,
        campaignName: demografiaInsights.campaignName,
        age: demografiaInsights.age,
        gender: demografiaInsights.gender,
        spend: demografiaInsights.spend,
        impressions: demografiaInsights.impressions,
        clicks: demografiaInsights.clicks,
        actions: demografiaInsights.actions,
        actionValues: demografiaInsights.actionValues,
        dateStop: demografiaInsights.dateStop,
      })
      .from(demografiaInsights)
      .where(
        and(
          inArray(demografiaInsights.adAccountId, contaIds),
          gte(demografiaInsights.dateStop, inicioAtual),
        ),
      )

    const dedup = deduplicarJanelaMaisRecente(demoRows, (r) => `${r.campaignId}|${r.age}|${r.gender}`)
    demografia = agregarDemografia(dedup)
    for (const linha of demografia) {
      linha.resultados = resultadoDaChave(
        { leads: linha.leads, vendas: linha.compras, conversas: linha.conversas },
        heroi.chave,
      )
    }
  } catch {
    // demografia_insights pode não existir/estar vazia — seção fica vazia
  }

  // Query D: regiao_insights — mesmo padrão de janela ~30d + dedupe por
  // (campaignId, region); o ranking escolhe a métrica pela COBERTURA do dado
  // (chave-herói quando o Meta entrega o suficiente; senão cliques no link).
  let regioes: RankingRegioes = { metrica: 'heroi', motivo: 'heroi', linhas: [] }
  try {
    const regiaoRows = await db
      .select({
        campaignId: regiaoInsights.campaignId,
        campaignName: regiaoInsights.campaignName,
        region: regiaoInsights.region,
        spend: regiaoInsights.spend,
        impressions: regiaoInsights.impressions,
        clicks: regiaoInsights.clicks,
        actions: regiaoInsights.actions,
        actionValues: regiaoInsights.actionValues,
        dateStop: regiaoInsights.dateStop,
      })
      .from(regiaoInsights)
      .where(
        and(
          inArray(regiaoInsights.adAccountId, contaIds),
          gte(regiaoInsights.dateStop, inicioAtual),
        ),
      )

    const dedup = deduplicarJanelaMaisRecente(regiaoRows, (r) => `${r.campaignId}|${r.region}`)

    // Query D2 (SEQUENCIAL, nunca Promise.all): denominador da cobertura — total da
    // chave-herói no MESMO recorte do numerador:
    // - mesma janela ~30d do sync de região (NÃO o período selecionado: 7d contra 30d
    //   inflaria a cobertura, 90d a subestimaria);
    // - só as campanhas que vieram no breakdown (campanha ausente do breakdown inflaria
    //   o denominador e dispararia fallback falso).
    const campanhas = campanhasComRegiao(dedup)
    let totalReferencia = 0
    if (campanhas.length > 0) {
      const inicioJanelaRegiao = dataMenosDias(29, hojeBrasilia())
      const refRows = await db
        .select({ actions: campaignInsights.actions })
        .from(campaignInsights)
        .where(
          and(
            inArray(campaignInsights.adAccountId, contaIds),
            inArray(campaignInsights.campaignId, campanhas),
            gte(campaignInsights.date, inicioJanelaRegiao),
          ),
        )
      totalReferencia = refRows.reduce(
        (soma, r) => soma + resultadoDaChave(parseActionsExtendido(r.actions), heroi.chave),
        0,
      )
    }

    regioes = rankingDeRegioes(dedup, heroi.chave, totalReferencia)
  } catch {
    // regiao_insights pode não existir/estar vazia — seção fica vazia
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
    demografia,
    regioes,
    temDados: totaisAtual.spend > 0 || totaisAtual.impressions > 0 || campanhas.length > 0,
  }
}
