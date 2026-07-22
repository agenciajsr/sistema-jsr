import { getValidAdsAccessToken } from './ads-credentials'

// Client REST do Google Ads — mesmo espírito do client da Meta (fetch direto +
// tratamento defensivo), sem SDK pesado. Autentica com o access_token do OAuth
// (renovado por ads-credentials.ts) + o developer token + o login-customer-id
// (MCC) nos headers. Só LEMOS (GAQL search) — nunca alteramos campanhas.

const BASE_URL = 'https://googleads.googleapis.com'

function getEnv(key: string): string {
  const val = process.env[key]?.trim()
  if (!val) throw new Error(`Variavel de ambiente ${key} nao configurada.`)
  return val
}

/** Versão da API. v20 foi descontinuada; default v21. Ajustável por env. */
export function getAdsApiVersion(): string {
  const bruto = (process.env.GOOGLE_ADS_API_VERSION ?? 'v21').replace(/["']/g, '').trim()
  return bruto.startsWith('v') ? bruto : `v${bruto}`
}

/** ID da MCC (login-customer-id) sem hífens. */
function getMccId(): string {
  return getEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID').replace(/-/g, '')
}

/** true quando o SYNC do Google Ads tem tudo que precisa (token + MCC + conexão). */
export function adsSyncConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  )
}

/**
 * Executa uma query GAQL (googleAds:search) numa conta. `customerId` é a conta
 * consultada; o login-customer-id (MCC) vai sempre no header para autorizar via
 * hierarquia. Retorna o array de `results` cru. Lança em erro HTTP (o chamador
 * decide como degradar).
 */
export async function adsSearch(customerId: string, query: string): Promise<unknown[]> {
  const token = await getValidAdsAccessToken()
  if (!token) throw new Error('Google Ads não conectado (sem credenciais OAuth).')

  const version = getAdsApiVersion()
  const cid = customerId.replace(/-/g, '')
  const res = await fetch(`${BASE_URL}/${version}/customers/${cid}/googleAds:search`, {
    method: 'POST',
    headers: {
      'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
      'login-customer-id': getMccId(),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[Google Ads] Erro ${res.status}: ${body.slice(0, 500)}`)
  }
  const json = (await res.json()) as { results?: unknown[] }
  return Array.isArray(json.results) ? json.results : []
}

export type ContaGoogleAds = {
  id: string
  nome: string
  /** true = conta gerenciadora (a própria MCC ou sub-MCC); false = conta de anúncio. */
  gerenciadora: boolean
  nivel: number
  moeda: string | null
}

/**
 * Lista as contas sob a MCC (customer_client). Inclui a própria MCC (nivel 0,
 * gerenciadora=true) e as contas de cliente vinculadas. Útil como "testar conexão"
 * e como base do sync (as contas de anúncio = gerenciadora=false).
 */
export async function listarContasDaMcc(): Promise<ContaGoogleAds[]> {
  const query =
    'SELECT customer_client.id, customer_client.descriptive_name, ' +
    'customer_client.manager, customer_client.level, customer_client.currency_code ' +
    "FROM customer_client WHERE customer_client.status = 'ENABLED'"

  const results = await adsSearch(getMccId(), query)
  const contas: ContaGoogleAds[] = []
  for (const row of results) {
    const c = (row as { customerClient?: Record<string, unknown> }).customerClient
    if (!c || c.id == null) continue
    contas.push({
      id: String(c.id),
      nome: typeof c.descriptiveName === 'string' ? c.descriptiveName : '',
      gerenciadora: c.manager === true,
      nivel: typeof c.level === 'number' ? c.level : Number(c.level ?? 0),
      moeda: typeof c.currencyCode === 'string' ? c.currencyCode : null,
    })
  }
  // Contas de anúncio primeiro (as gerenciadoras vão pro fim), depois por nome.
  return contas.sort(
    (a, b) => Number(a.gerenciadora) - Number(b.gerenciadora) || a.nome.localeCompare(b.nome),
  )
}
