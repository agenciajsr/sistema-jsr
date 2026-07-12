import { metaAdAccountsResponseSchema, metaAdInsightsResponseSchema, metaInsightsResponseSchema } from './schemas'

const META_BASE_URL = 'https://graph.facebook.com'

function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Variavel de ambiente ${key} nao configurada. Verifique o .env.local.`)
  return val
}

/**
 * Helper generico para chamadas a Graph API.
 * Adiciona access_token, pina versao, monitora rate limit.
 */
async function metaFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const version = getEnv('META_API_VERSION')
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
  const fields = 'id,name,account_status,currency'

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
 * Busca insights de campanhas de uma conta de anuncio (historico diario, ultimos 30 dias).
 * Segue paginação automaticamente (max 500 registros para segurança).
 * @param adAccountId ID numerico da conta (sem prefixo act_)
 */
export async function fetchCampaignInsights(adAccountId: string, datePreset: string = 'last_30d') {
  const raw = await metaFetch(`/act_${adAccountId}/insights`, {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values',
    date_preset: datePreset,
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
 * (sem time_increment — uma linha por anúncio no período inteiro para limitar volume).
 * Segue paginação automaticamente (max 400 registros).
 */
export async function fetchAdInsights(adAccountId: string, datePreset: string = 'last_30d') {
  const raw = await metaFetch(`/act_${adAccountId}/insights`, {
    level: 'ad',
    fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,actions,action_values',
    date_preset: datePreset,
    limit: '200',
  })

  const parsed = metaAdInsightsResponseSchema.parse(raw)
  const allData = [...parsed.data]

  // Seguir paginação (max 1 página extra = 400 registros)
  let nextUrl = parsed.paging?.next
  if (nextUrl) {
    try {
      const nextRaw = await metaFetchUrl(nextUrl)
      const nextParsed = metaAdInsightsResponseSchema.parse(nextRaw)
      allData.push(...nextParsed.data)
    } catch { /* ignorar erro de paginação extra */ }
  }

  return allData
}

/**
 * Busca thumbnails dos criativos ativos de uma conta (best-effort).
 * Retorna Map<adId, thumbnailUrl>. Nunca lança — retorna Map vazio em caso de erro.
 */
export async function fetchAdThumbnails(adAccountId: string): Promise<Map<string, string>> {
  try {
    const raw = await metaFetch(`/act_${adAccountId}/ads`, {
      fields: 'id,creative{thumbnail_url}',
      limit: '200',
    })

    const result = new Map<string, string>()
    const data = (raw as { data?: Array<{ id?: string; creative?: { thumbnail_url?: string } }> }).data
    if (!Array.isArray(data)) return result

    for (const ad of data) {
      const url = ad?.creative?.thumbnail_url
      if (ad?.id && url) {
        result.set(ad.id, url)
      }
    }
    return result
  } catch {
    return new Map()
  }
}
