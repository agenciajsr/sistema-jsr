import { format, subDays } from 'date-fns'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adAccounts, adInsights, clientes } from '@/lib/db/schema'
import {
  getMetricasIntervalo,
  listarClientesComContas,
  type MetricasIntervalo,
} from '@/lib/trafego/aggregate'
import type { Alerta, SeveridadeAlerta } from '@/lib/alertas/types'

// --- Thresholds (fáceis de ajustar) ---
/** CPA/CPL sem meta: variação relativa a partir da qual vira alerta (35%). */
const LIMIAR_ALTA_AUTO = 0.35
/** Queda relativa de resultado-herói ou CTR a partir da qual vira alerta (30%). */
const LIMIAR_QUEDA = 0.3
/** Fator do CPA/CPL sobre a meta a partir do qual o alerta vira crítico (1.5x). */
const META_FATOR_CRITICO = 1.5
/** Volume mínimo de resultado-herói no período anterior para avaliar queda. */
const VOLUME_MINIMO_RESULTADO = 5
/** Gasto a partir do qual "zero resultado-herói" vira alerta crítico. */
const SPEND_SEM_CONVERSAO = 100
/** Abaixo deste gasto no período atual, não geramos sinais comparativos. */
const SPEND_MINIMO_AVALIACAO = 50
/** Frequência (impressões/pessoa) a partir da qual sinalizamos fadiga de criativo. */
const FREQ_FADIGA = 3.5
/** Volume mínimo de impressões para o sinal de fadiga (evita ruído em baixa entrega). */
const FADIGA_MIN_IMPRESSIONS = 1000

// --- Pesos de penalidade no health score ---
const PESO_SEM_CONVERSAO = 30
const PESO_CRITICO_CPA = 25
const PESO_PERFORMANCE = 12
const PESO_CTR = 12
const PESO_ATENCAO = 12
const PESO_INFO = 5

// --- Tipos ---
export type HealthScore = {
  clienteId: string
  score: number
  rotulo: 'Saudável' | 'Atenção' | 'Crítico'
}

/** Linha de status por anúncio usada nos sinais de criativo (rejeição/fadiga). */
export type AdStatusRow = {
  adId: string
  adName: string
  effectiveStatus: string | null
  frequency: number | null
  impressions: number
  spend: number
}

export type EntradaSaude = {
  clienteId: string
  clienteNome: string
  metaCpa: number | null
  metaCpl: number | null
  atual: MetricasIntervalo
  anterior: MetricasIntervalo
  /** Anúncios do cliente (status/frequência). Opcional → [] mantém comportamento anterior. */
  ads?: AdStatusRow[]
}

// --- Formatação (pt-BR) ---
const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function moeda(valor: number): string {
  return formatadorMoeda.format(valor)
}

function pct(fracao: number): string {
  return `${Math.round(fracao * 100)}%`
}

function criarAlerta(
  idBase: string,
  tipo: Alerta['tipo'],
  severidade: SeveridadeAlerta,
  titulo: string,
  detalhe: string,
  e: EntradaSaude,
  hoje: string,
): Alerta {
  return {
    id: `${idBase}-${e.clienteId}`,
    tipo,
    severidade,
    titulo,
    detalhe,
    clienteNome: e.clienteNome,
    clienteId: e.clienteId,
    dataRelevante: hoje,
  }
}

/**
 * FUNÇÃO PURA — sinal de criativo rejeitado. Prioriza DISAPPROVED (crítico) sobre
 * WITH_ISSUES (atenção). Ignora demais status e linhas com effectiveStatus null
 * (degradação graciosa). Emite no máximo 1 alerta por cliente.
 */
function avaliarCriativoRejeitado(ads: AdStatusRow[], e: EntradaSaude, hoje: string): Alerta | null {
  const reprovados = ads.filter((a) => a.effectiveStatus === 'DISAPPROVED')
  const comPendencias = ads.filter((a) => a.effectiveStatus === 'WITH_ISSUES')
  const grupo = reprovados.length > 0 ? reprovados : comPendencias
  if (grupo.length === 0) return null

  const critico = reprovados.length > 0
  const extras = grupo.length - 1
  const sufixo = extras > 0 ? ` (+${extras} outro${extras > 1 ? 's' : ''})` : ''
  const verbo = critico ? 'reprovado' : 'com pendências'
  return criarAlerta(
    'saude-criativo-rejeitado',
    'criativo_rejeitado',
    critico ? 'critico' : 'atencao',
    critico ? 'Criativo reprovado' : 'Criativo com pendências',
    `Anúncio "${grupo[0].adName}" ${verbo} pela Meta${sufixo}.`,
    e,
    hoje,
  )
}

/**
 * FUNÇÃO PURA — sinal de fadiga de criativo. Considera anúncios com
 * frequency >= FREQ_FADIGA e impressions >= FADIGA_MIN_IMPRESSIONS. Escolhe o de
 * maior frequência. Ignora frequency null (degradação graciosa). Máx. 1 por cliente.
 */
function avaliarFadigaCriativo(ads: AdStatusRow[], e: EntradaSaude, hoje: string): Alerta | null {
  const candidatos = ads.filter(
    (a) => a.frequency != null && a.frequency >= FREQ_FADIGA && a.impressions >= FADIGA_MIN_IMPRESSIONS,
  )
  if (candidatos.length === 0) return null

  const pior = candidatos.reduce((max, a) => ((a.frequency ?? 0) > (max.frequency ?? 0) ? a : max))
  return criarAlerta(
    'saude-fadiga',
    'fadiga_criativo',
    'atencao',
    'Fadiga de criativo',
    `Frequência ${(pior.frequency ?? 0).toFixed(1)} no anúncio "${pior.adName}" — público pode estar saturado.`,
    e,
    hoje,
  )
}

/**
 * FUNÇÃO PURA — avalia os sinais de saúde de um cliente comparando o período
 * atual com o anterior. Retorna alertas no MESMO formato do motor existente.
 * Não faz I/O. Cliente sem dados no período atual (spend 0) → nenhum alerta
 * comparativo, mas sinais de criativo (rejeição/fadiga) ainda valem — um criativo
 * reprovado pode ser justamente a causa da verba parada.
 */
export function avaliarSaudeCliente(e: EntradaSaude): Alerta[] {
  const alertas: Alerta[] = []
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const { atual, anterior, metaCpa, metaCpl } = e

  // Sinais de criativo — independentes do gasto agregado (avaliados sobre e.ads).
  const ads = e.ads ?? []
  const rejeitado = avaliarCriativoRejeitado(ads, e, hoje)
  if (rejeitado) alertas.push(rejeitado)
  const fadiga = avaliarFadigaCriativo(ads, e, hoje)
  if (fadiga) alertas.push(fadiga)

  // Sem dados no período atual → não penalizar ausência de dados (sinais comparativos).
  if (atual.spend <= 0) return alertas

  // 1. Gastando sem converter (usa o próprio limiar, independente do gate geral).
  if (atual.spend >= SPEND_SEM_CONVERSAO && atual.resultadoHeroi === 0) {
    alertas.push(
      criarAlerta(
        'saude-sem-conversao',
        'sem_conversao',
        'critico',
        'Gastando sem converter',
        `${moeda(atual.spend)} investidos no período sem nenhum resultado (${atual.heroi.label.toLowerCase()}).`,
        e,
        hoje,
      ),
    )
  }

  // Sinais comparativos só quando o gasto atual é relevante (evita ruído).
  if (atual.spend >= SPEND_MINIMO_AVALIACAO) {
    // 2. CPA/CPL: escolhe a métrica conforme a chave-herói.
    const usaCpl = atual.heroi.chave === 'leads'
    const label = usaCpl ? 'CPL' : 'CPA'
    const custoAtual = usaCpl ? atual.cpl : atual.cpa
    const custoAnterior = usaCpl ? anterior.cpl : anterior.cpa
    const meta = usaCpl ? metaCpl : metaCpa

    if (meta != null && meta > 0) {
      // Com meta manual.
      if (custoAtual != null && custoAtual > meta) {
        const critico = custoAtual >= meta * META_FATOR_CRITICO
        alertas.push(
          criarAlerta(
            'saude-cpa',
            'cpa_alto',
            critico ? 'critico' : 'atencao',
            `${label} acima da meta`,
            `${label} atual de ${moeda(custoAtual)} vs. meta de ${moeda(meta)}.`,
            e,
            hoje,
          ),
        )
      }
    } else if (custoAtual != null && custoAnterior != null && custoAnterior > 0) {
      // Sem meta → baseline automático por histórico.
      const variacao = (custoAtual - custoAnterior) / custoAnterior
      if (variacao >= LIMIAR_ALTA_AUTO) {
        alertas.push(
          criarAlerta(
            'saude-cpa',
            'cpa_alto',
            'atencao',
            `${label} subindo`,
            `${label} subiu ${pct(variacao)} vs. período anterior (${moeda(custoAnterior)} → ${moeda(custoAtual)}).`,
            e,
            hoje,
          ),
        )
      }
    }

    // 3. Queda de resultado-herói (com volume mínimo no período anterior).
    if (anterior.resultadoHeroi >= VOLUME_MINIMO_RESULTADO) {
      const queda = (anterior.resultadoHeroi - atual.resultadoHeroi) / anterior.resultadoHeroi
      if (queda >= LIMIAR_QUEDA) {
        alertas.push(
          criarAlerta(
            'saude-perf',
            'performance_caindo',
            'atencao',
            `Queda de ${atual.heroi.label.toLowerCase()}`,
            `${atual.heroi.label} caiu ${pct(queda)} vs. período anterior (${anterior.resultadoHeroi} → ${atual.resultadoHeroi}).`,
            e,
            hoje,
          ),
        )
      }
    }

    // 4. Queda de CTR.
    if (anterior.ctr != null && anterior.ctr > 0 && atual.ctr != null) {
      const quedaCtr = (anterior.ctr - atual.ctr) / anterior.ctr
      if (quedaCtr >= LIMIAR_QUEDA) {
        alertas.push(
          criarAlerta(
            'saude-ctr',
            'ctr_caindo',
            'atencao',
            'Queda de CTR',
            `CTR caiu ${pct(quedaCtr)} vs. período anterior (${anterior.ctr.toFixed(2)}% → ${atual.ctr.toFixed(2)}%).`,
            e,
            hoje,
          ),
        )
      }
    }
  }

  return alertas
}

function penalidade(a: Alerta): number {
  switch (a.tipo) {
    case 'sem_conversao':
      return PESO_SEM_CONVERSAO
    case 'cpa_alto':
      return a.severidade === 'critico' ? PESO_CRITICO_CPA : PESO_ATENCAO
    case 'performance_caindo':
      return PESO_PERFORMANCE
    case 'ctr_caindo':
      return PESO_CTR
    case 'criativo_rejeitado':
      return a.severidade === 'critico' ? PESO_CRITICO_CPA : PESO_ATENCAO
    case 'fadiga_criativo':
      return PESO_ATENCAO
    default:
      if (a.severidade === 'critico') return PESO_CRITICO_CPA
      if (a.severidade === 'atencao') return PESO_ATENCAO
      return PESO_INFO
  }
}

/**
 * FUNÇÃO PURA — 100 menos as penalidades dos alertas ativos do próprio cliente,
 * com piso 0. Rótulo por faixa: >=80 Saudável, >=50 Atenção, <50 Crítico.
 */
export function calcularHealthScore(clienteId: string, alertas: Alerta[]): HealthScore {
  const doCliente = alertas.filter((a) => a.clienteId === clienteId)
  const total = doCliente.reduce((soma, a) => soma + penalidade(a), 0)
  const score = Math.max(0, 100 - total)
  const rotulo: HealthScore['rotulo'] = score >= 80 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico'
  return { clienteId, score, rotulo }
}

// --- Orquestradores (I/O) ---

/** Janelas de comparação: atual = últimos 7 dias, anterior = 7 dias antes disso. */
function janelas() {
  const hoje = new Date()
  return {
    atualDe: format(subDays(hoje, 7), 'yyyy-MM-dd'),
    atualAte: format(hoje, 'yyyy-MM-dd'),
    anteriorDe: format(subDays(hoje, 14), 'yyyy-MM-dd'),
    anteriorAte: format(subDays(hoje, 8), 'yyyy-MM-dd'),
  }
}

async function buscarMetas(
  clienteId: string,
): Promise<{ metaCpa: number | null; metaCpl: number | null }> {
  const c = await db.query.clientes.findFirst({
    where: eq(clientes.id, clienteId),
    columns: { metaCpa: true, metaCpl: true },
  })
  return {
    metaCpa: c?.metaCpa != null ? Number(c.metaCpa) : null,
    metaCpl: c?.metaCpl != null ? Number(c.metaCpl) : null,
  }
}

/**
 * Busca o status por anúncio (linha mais recente por adId) das contas Meta ativas
 * do cliente. Robusto: retorna [] em qualquer erro (colunas podem ainda estar
 * nulas/ausentes antes de um novo sync) — degradação graciosa.
 */
async function buscarAdsStatus(clienteId: string): Promise<AdStatusRow[]> {
  try {
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
    if (contas.length === 0) return []

    const rows = await db
      .select({
        adId: adInsights.adId,
        adName: adInsights.adName,
        effectiveStatus: adInsights.effectiveStatus,
        frequency: adInsights.frequency,
        impressions: adInsights.impressions,
        spend: adInsights.spend,
        syncedAt: adInsights.syncedAt,
      })
      .from(adInsights)
      .where(inArray(adInsights.adAccountId, contas.map((c) => c.id)))

    // Deduplicar por adId, mantendo a linha mais recente (maior syncedAt).
    const maisRecente = new Map<string, (typeof rows)[number]>()
    for (const r of rows) {
      const anterior = maisRecente.get(r.adId)
      const tsAtual = r.syncedAt?.getTime() ?? 0
      const tsAnterior = anterior?.syncedAt?.getTime() ?? 0
      if (!anterior || tsAtual >= tsAnterior) maisRecente.set(r.adId, r)
    }

    return [...maisRecente.values()].map((r) => ({
      adId: r.adId,
      adName: r.adName,
      effectiveStatus: r.effectiveStatus ?? null,
      frequency: r.frequency != null ? Number(r.frequency) : null,
      impressions: r.impressions ?? 0,
      spend: r.spend != null ? Number(r.spend) : 0,
    }))
  } catch {
    return []
  }
}

/**
 * Alertas de saúde de campanha de TODOS os clientes com contas Meta ativas.
 * Não ordena (quem consome ordena). Não lança para um cliente individual —
 * falhas isoladas são ignoradas para não derrubar o lote.
 */
export async function getAlertasCampanhas(): Promise<Alerta[]> {
  const lista = await listarClientesComContas()
  const { atualDe, atualAte, anteriorDe, anteriorAte } = janelas()
  const todos: Alerta[] = []

  for (const c of lista) {
    try {
      const [atual, anterior, metas, ads] = await Promise.all([
        getMetricasIntervalo(c.id, atualDe, atualAte),
        getMetricasIntervalo(c.id, anteriorDe, anteriorAte),
        buscarMetas(c.id),
        buscarAdsStatus(c.id),
      ])
      const alertas = avaliarSaudeCliente({
        clienteId: c.id,
        clienteNome: c.nome,
        metaCpa: metas.metaCpa,
        metaCpl: metas.metaCpl,
        atual,
        anterior,
        ads,
      })
      todos.push(...alertas)
    } catch {
      // Falha em um cliente não interrompe a avaliação dos demais.
    }
  }

  return todos
}

/**
 * Health score de UM cliente (mesma janela de 7d atual vs. anterior).
 * Retorna 100/Saudável quando não há dados. Null apenas se algo falhar.
 */
export async function getSaudeDoCliente(clienteId: string): Promise<HealthScore | null> {
  if (!clienteId) return null
  try {
    const { atualDe, atualAte, anteriorDe, anteriorAte } = janelas()
    const [atual, anterior, metas, ads] = await Promise.all([
      getMetricasIntervalo(clienteId, atualDe, atualAte),
      getMetricasIntervalo(clienteId, anteriorDe, anteriorAte),
      buscarMetas(clienteId),
      buscarAdsStatus(clienteId),
    ])
    const alertas = avaliarSaudeCliente({
      clienteId,
      clienteNome: '',
      metaCpa: metas.metaCpa,
      metaCpl: metas.metaCpl,
      atual,
      anterior,
      ads,
    })
    return calcularHealthScore(clienteId, alertas)
  } catch {
    return null
  }
}
