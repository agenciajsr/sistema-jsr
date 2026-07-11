import { metaAdAccountsResponseSchema, metaInsightsResponseSchema } from './schemas'

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

  const res = await fetch(url.toString())

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
 * Busca insights de campanhas de uma conta de anuncio (historico diario, ultimos 30 dias).
 * Com time_increment '1', a Meta retorna UMA linha por dia por campanha,
 * cada uma com date_start === date_stop = o dia. O sync (sync-meta-ads.ts) usa
 * insight.date_start como date e faz upsert por (adAccountId, date, campaignId),
 * lidando corretamente com o historico sem alteracao no schema.
 * @param adAccountId ID numerico da conta (sem prefixo act_)
 */
export async function fetchCampaignInsights(adAccountId: string) {
  const raw = await metaFetch(`/act_${adAccountId}/insights`, {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions',
    date_preset: 'last_30d',
    time_increment: '1',
  })

  const parsed = metaInsightsResponseSchema.parse(raw)
  return parsed.data
}
