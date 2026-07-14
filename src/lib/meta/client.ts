import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'

import { metaAdAccountsResponseSchema, metaAdInsightsResponseSchema, metaInsightsResponseSchema } from './schemas'

const META_BASE_URL = 'https://graph.facebook.com'

function getEnv(key: string): string {
  const val = process.env[key]?.trim()
  if (!val) throw new Error(`Variavel de ambiente ${key} nao configurada. Verifique o .env.local.`)
  return val
}

// Normaliza a versão da Graph API: aceita "v25.0", "25.0", com espaços/aspas
// acidentais do painel da Vercel — qualquer forma vira "v25.0". Sem isto, um
// valor sem o "v" gera o erro criptico "Unknown path components" (code 2500)
// em TODAS as chamadas, como aconteceu em produção em 14/jul/2026.
function getApiVersion(): string {
  const bruto = getEnv('META_API_VERSION').replace(/["']/g, '').trim()
  return bruto.startsWith('v') ? bruto : `v${bruto}`
}

/**
 * Helper generico para chamadas a Graph API.
 * Adiciona access_token, pina versao, monitora rate limit.
 */
async function metaFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const version = getApiVersion()
  const token = getEnv('META_SYSTEM_USER_TOKEN')

  const url = new URL(`${META_BASE_URL}/${version}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })

  // Monitorar rate limit via header X-Business-Use-Case-Usage
  const usageHeader = res.headers.get('x-business-use-case-usage')
  if (usageHeader) {
    try {
      const usage = JSON.parse(usageHeader) as Record<string, Array<{ call_count: number; total_cputime: number; total_time: number }>>
      for (const [accountId, buckets] of Object.entries(usage)) {
        for (const bucket of buckets) {
          const maxUsage = Math.max(bucket.call_count, bucket.total_cputime, bucket.total_time)
          if (maxUsage > 80) {
            console.warn(`[Meta API] Rate limit alto (${maxUsage}%) para conta ${accountId}. Considerar backoff.`)
          }
        }
      }
    } catch {
      // Header com formato inesperado — ignorar silenciosamente
    }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[Meta API] Erro ${res.status} em ${path}: ${body}`)
  }

  return res.json()
}

/**
 * Busca o saldo restante de uma conta de anuncio.
 * spend_cap = limite total de gasto definido na conta; amount_spent = quanto ja gastou.
 * Saldo = spend_cap - amount_spent. Se nao tiver spend_cap, retorna null (sem limite).
 */
export async function fetchAccountBalance(adAccountId: string): Promise<number | null> {
  try {
    const raw = await metaFetch(`/act_${adAccountId}`, {
      fields: 'spend_cap,amount_spent',
    })
    const data = raw as { spend_cap?: string; amount_spent?: string }
    if (!data.spend_cap || data.spend_cap === '0') return null
    const spendCap = Number(data.spend_cap) / 100 // Meta retorna em centavos
    const amountSpent = Number(data.amount_spent ?? '0') / 100
    return Math.max(spendCap - amountSpent, 0)
  } catch {
    return null
  }
}

/**
 * Busca todas as contas de anuncio da Business Manager (owned + client).
 * Combina os dois endpoints e remove duplicatas por id.
 */
export async function fetchMetaAdAccounts() {
  const businessId = getEnv('META_BUSINESS_ID')
  const fields = 'id,name,account_status,currency,funding_source'

  const [ownedRaw, clientRaw] = await Promise.all([
    metaFetch(`/${businessId}/owned_ad_accounts`, { fields, limit: '100' }),
    metaFetch(`/${businessId}/client_ad_accounts`, { fields, limit: '100' }),
  ])

  const owned = metaAdAccountsResponseSchema.parse(ownedRaw)
  const client = metaAdAccountsResponseSchema.parse(clientRaw)

  // Combinar sem duplicatas (por id)
  const seen = new Set<string>()
  const all = [...owned.data, ...client.data].filter((acc) => {
    if (seen.has(acc.id)) return false
    seen.add(acc.id)
    return true
  })

  return all
}

/**
 * Busca uma URL completa da Meta (usada para paginação — next URLs já incluem token).
 */
async function metaFetchUrl(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[Meta API] Erro ${res.status}: ${body}`)
  }
  return res.json()
}

/**
 * Busca insights de campanhas de uma conta de anuncio (historico diario, ultimos 30 dias
 * ATÉ hoje no fuso de Brasília — via time_range, pois date_preset='last_30d' NÃO inclui hoje).
 * O dado de "hoje" na Meta é PARCIAL e muda ao longo do dia (comportamento esperado).
 * Segue paginação automaticamente (max 500 registros para segurança).
 * @param adAccountId ID numerico da conta (sem prefixo act_)
 */
export async function fetchCampaignInsights(adAccountId: string) {
  const until = hojeBrasilia()
  const since = dataMenosDias(30, until)
  const raw = await metaFetch(`/act_${adAccountId}/insights`, {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '100',
  })

  const parsed = metaInsightsResponseSchema.parse(raw)
  const allData = [...parsed.data]

  // Seguir paginação
  let nextUrl = parsed.paging?.next
  let pages = 0
  while (nextUrl && pages < 4) { // max 5 páginas = 500 registros
    const nextRaw = await metaFetchUrl(nextUrl)
    const nextParsed = metaInsightsResponseSchema.parse(nextRaw)
    allData.push(...nextParsed.data)
    nextUrl = nextParsed.paging?.next
    pages++
  }

  return allData
}

/**
 * Busca insights nível anúncio (ad-level) de uma conta. Agregado nos últimos 30 dias
 * ATÉ hoje no fuso de Brasília (via time_range, pois date_preset='last_30d' NÃO inclui hoje).
 * Sem time_increment — uma linha por anúncio no período inteiro para limitar volume.
 * O dado de "hoje" na Meta é PARCIAL e muda ao longo do dia (comportamento esperado).
 * Segue paginação automaticamente (max 400 registros).
 */
export async function fetchAdInsights(adAccountId: string) {
  const until = hojeBrasilia()
  const since = dataMenosDias(30, until)
  const raw = await metaFetch(`/act_${adAccountId}/insights`, {
    level: 'ad',
    fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,reach,clicks,frequency,actions,action_values',
    time_range: JSON.stringify({ since, until }),
    limit: '200',
  })

  const parsed = metaAdInsightsResponseSchema.parse(raw)
  const allData = [...parsed.data]

  // Seguir paginação (max 1 página extra = 400 registros)
  const nextUrl = parsed.paging?.next
  if (nextUrl) {
    try {
      const nextRaw = await metaFetchUrl(nextUrl)
      const nextParsed = metaAdInsightsResponseSchema.parse(nextRaw)
      allData.push(...nextParsed.data)
    } catch { /* ignorar erro de paginação extra */ }
  }

  return allData
}

/** Metadados de nível anúncio buscados no endpoint /ads (best-effort). */
export type AdMeta = {
  thumbnailUrl: string | null
  effectiveStatus: string | null
}

/**
 * Busca metadados dos anúncios de uma conta (best-effort): thumbnail do criativo
 * e status de aprovação (effective_status). Retorna Map<adId, AdMeta>.
 * Nunca lança — retorna Map vazio em caso de erro; entradas sem id são ignoradas.
 */
export async function fetchAdMeta(adAccountId: string): Promise<Map<string, AdMeta>> {
  try {
    const raw = await metaFetch(`/act_${adAccountId}/ads`, {
      fields: 'id,effective_status,creative{thumbnail_url}',
      limit: '200',
    })

    const result = new Map<string, AdMeta>()
    const data = (raw as {
      data?: Array<{ id?: string; effective_status?: string; creative?: { thumbnail_url?: string } }>
    }).data
    if (!Array.isArray(data)) return result

    for (const ad of data) {
      if (!ad?.id) continue
      result.set(ad.id, {
        thumbnailUrl: ad.creative?.thumbnail_url ?? null,
        effectiveStatus: ad.effective_status ?? null,
      })
    }
    return result
  } catch {
    return new Map()
  }
}
