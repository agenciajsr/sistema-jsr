'use server'

import { eq, and, gte, sql, desc, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { adAccounts, campaignInsights, clientes, preferenciasCampanhas } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { sincronizarContasMeta } from '@/lib/meta/sync'

export type TrafegoCampanha = {
  campaignId: string
  campaignName: string
  date: string
  spend: string
  impressions: number
  clicks: number
  reach: number
  cpc: string | null
  cpm: string | null
  ctr: string | null
  actions: unknown
}

export type TrafegoAccount = {
  id: string
  metaAccountId: string
  nome: string
  clienteNome: string | null
  accountStatus: number | null
  currency: string | null
  campanhas: TrafegoCampanha[]
  spendTotal: number
  ultimaSync: Date | null
}

export async function getTrafegoData(): Promise<TrafegoAccount[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  // Data de 7 dias atras
  const hoje = new Date()
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
  const dataMinima = seteDiasAtras.toISOString().slice(0, 10)

  // Buscar contas ativas da Meta
  const contas = await db
    .select({
      id: adAccounts.id,
      metaAccountId: adAccounts.metaAccountId,
      nome: adAccounts.nome,
      accountStatus: adAccounts.accountStatus,
      currency: adAccounts.currency,
      clienteNome: clientes.nome,
    })
    .from(adAccounts)
    .leftJoin(clientes, eq(adAccounts.clienteId, clientes.id))
    .where(eq(adAccounts.ativo, true))
    .orderBy(adAccounts.nome)

  const result: TrafegoAccount[] = []

  for (const conta of contas) {
    // Buscar insights dos ultimos 7 dias
    const insights = await db
      .select({
        campaignId: campaignInsights.campaignId,
        campaignName: campaignInsights.campaignName,
        date: campaignInsights.date,
        spend: campaignInsights.spend,
        impressions: campaignInsights.impressions,
        clicks: campaignInsights.clicks,
        reach: campaignInsights.reach,
        cpc: campaignInsights.cpc,
        cpm: campaignInsights.cpm,
        ctr: campaignInsights.ctr,
        actions: campaignInsights.actions,
        syncedAt: campaignInsights.syncedAt,
      })
      .from(campaignInsights)
      .where(
        and(
          eq(campaignInsights.adAccountId, conta.id),
          gte(campaignInsights.date, dataMinima),
        ),
      )
      .orderBy(desc(campaignInsights.date))

    const spendTotal = insights.reduce((acc, i) => acc + Number(i.spend), 0)
    const ultimaSync = insights.length > 0
      ? insights.reduce((latest, i) => (i.syncedAt > latest ? i.syncedAt : latest), insights[0].syncedAt)
      : null

    result.push({
      id: conta.id,
      metaAccountId: conta.metaAccountId,
      nome: conta.nome,
      clienteNome: conta.clienteNome,
      accountStatus: conta.accountStatus,
      currency: conta.currency,
      campanhas: insights.map((i) => ({
        campaignId: i.campaignId,
        campaignName: i.campaignName,
        date: i.date,
        spend: i.spend,
        impressions: i.impressions ?? 0,
        clicks: i.clicks ?? 0,
        reach: i.reach ?? 0,
        cpc: i.cpc,
        cpm: i.cpm,
        ctr: i.ctr,
        actions: i.actions,
      })),
      spendTotal,
      ultimaSync,
    })
  }

  return result
}

export async function triggerMetaSync(clienteId?: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  try {
    const { contas, insights } = await sincronizarContasMeta(clienteId)
    return { data: { contas, insights } }
  } catch (err) {
    console.error('[triggerMetaSync] Falha na sync:', err)
    return { error: 'Nao foi possivel sincronizar. Tente novamente.' }
  }
}

export async function getUltimaSync(): Promise<Date | null> {
  const [result] = await db
    .select({ max: sql<string | null>`max(${campaignInsights.syncedAt})` })
    .from(campaignInsights)

  return result.max ? new Date(result.max) : null
}

export type ContaNaoVinculada = {
  id: string
  nome: string
  metaAccountId: string
  accountStatus: number | null
}

/**
 * Contas ativas (qualquer plataforma) ainda sem cliente vinculado (cliente_id NULL).
 */
export async function getContasNaoVinculadas(): Promise<ContaNaoVinculada[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      metaAccountId: adAccounts.metaAccountId,
      accountStatus: adAccounts.accountStatus,
    })
    .from(adAccounts)
    .where(
      and(
        isNull(adAccounts.clienteId),
        eq(adAccounts.ativo, true),
      ),
    )
    .orderBy(adAccounts.nome)
}

export type ContaDoCliente = {
  id: string
  nome: string
  metaAccountId: string
  plataforma: 'meta' | 'google'
  accountStatus: number | null
  ativo: boolean
}

/**
 * Todas as contas de anuncio (qualquer plataforma) vinculadas a um cliente.
 */
export async function getContasDoCliente(clienteId: string): Promise<ContaDoCliente[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      metaAccountId: adAccounts.metaAccountId,
      plataforma: adAccounts.plataforma,
      accountStatus: adAccounts.accountStatus,
      ativo: adAccounts.ativo,
    })
    .from(adAccounts)
    .where(eq(adAccounts.clienteId, clienteId))
    .orderBy(adAccounts.nome)
}

/**
 * Clientes ativos (id, nome) para popular selects de vinculo.
 */
export async function listarClientes(): Promise<{ id: string; nome: string }[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  return db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .where(eq(clientes.status, 'ativo'))
    .orderBy(clientes.nome)
}

/**
 * Vincula (ou desvincula, com clienteId null) uma conta de anuncio a um cliente.
 * Protegido por sessao. Revalida /campanhas para a conta sumir da secao "nao vinculadas".
 */
export async function vincularContaAoCliente(
  adAccountId: string,
  clienteId: string | null,
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  try {
    await db
      .update(adAccounts)
      .set({ clienteId, updatedAt: new Date() })
      .where(eq(adAccounts.id, adAccountId))

    revalidatePath('/campanhas')
    if (clienteId) {
      revalidatePath(`/clientes/${clienteId}`)
    }
    return { data: { ok: true } }
  } catch (err) {
    console.error('[vincularContaAoCliente] Erro ao vincular conta:', err)
    return { error: 'Nao foi possivel vincular a conta. Tente novamente.' }
  }
}

// --- Preferências do painel /campanhas (por cliente) ---

// `meta` é aditiva (semáforo, Feature 1 — 17/jul/2026): vive no MESMO jsonb
// `kpis` — linhas antigas sem meta continuam válidas, zero migration.
export type PreferenciaKpi = {
  id: string
  ativo: boolean
  meta?: { bom: number; ruim: number; ativa: boolean } | null
}
export type PreferenciaFunil = { campanhas: string[] | null; etapas: string[] }
export type PreferenciasCampanhas = {
  kpis: PreferenciaKpi[] | null
  funil: PreferenciaFunil | null
}

/**
 * Preferências salvas do cliente para a grade de KPIs e o funil.
 * Degradação graciosa (padrão getWorkspaceAtual): erro/'relation does not exist'
 * (migration 0024 ainda não aplicada) -> null, a página usa os padrões.
 */
export async function getPreferenciasCampanhas(
  clienteId: string,
): Promise<PreferenciasCampanhas | null> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  try {
    const [row] = await db
      .select({ kpis: preferenciasCampanhas.kpis, funil: preferenciasCampanhas.funil })
      .from(preferenciasCampanhas)
      .where(eq(preferenciasCampanhas.clienteId, clienteId))
      .limit(1)
    if (!row) return { kpis: null, funil: null }
    return {
      kpis: (row.kpis as PreferenciaKpi[] | null) ?? null,
      funil: (row.funil as PreferenciaFunil | null) ?? null,
    }
  } catch (e) {
    // Migration 0024 ainda não aplicada ou soluço de conexão — usar padrões.
    console.error('[getPreferenciasCampanhas]', e)
    return null
  }
}

/**
 * Salva (upsert por cliente) as preferências da grade de KPIs e/ou do funil.
 * Só sobrescreve o campo enviado (kpis e funil são independentes).
 */
export async function salvarPreferenciasCampanhas(
  clienteId: string,
  prefs: { kpis?: PreferenciaKpi[]; funil?: PreferenciaFunil },
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  try {
    await db
      .insert(preferenciasCampanhas)
      .values({
        clienteId,
        kpis: prefs.kpis ?? null,
        funil: prefs.funil ?? null,
      })
      .onConflictDoUpdate({
        target: preferenciasCampanhas.clienteId,
        set: {
          ...(prefs.kpis !== undefined ? { kpis: prefs.kpis } : {}),
          ...(prefs.funil !== undefined ? { funil: prefs.funil } : {}),
          updatedAt: new Date(),
        },
      })

    revalidatePath('/campanhas')
    return { data: { ok: true } }
  } catch (err) {
    console.error('[salvarPreferenciasCampanhas] Erro ao salvar:', err)
    return {
      error:
        'Nao foi possivel salvar as preferencias (a migration 0024 pode nao ter sido aplicada). A configuracao vale so para esta sessao.',
    }
  }
}

// Formas de pagamento MANUAIS válidas (o Meta bloqueia esse dado — ver Verbas).
const FORMAS_PAGAMENTO_MANUAL = ['cartao_credito', 'pix_deposito', 'boleto', 'faturamento'] as const
export type FormaPagamentoManual = (typeof FORMAS_PAGAMENTO_MANUAL)[number]

/**
 * Define (ou limpa, com null) a forma de pagamento MANUAL de uma conta de anúncio.
 * O Meta não fornece funding_source_details (Permission Denied #10), então a equipe
 * registra à mão na tela de Verbas. Valida o valor contra a lista canônica.
 */
export async function atualizarFormaPagamentoConta(
  adAccountId: string,
  forma: FormaPagamentoManual | null,
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sessao expirada. Faca login novamente.' }

  if (forma !== null && !FORMAS_PAGAMENTO_MANUAL.includes(forma)) {
    return { error: 'Forma de pagamento invalida.' }
  }

  try {
    await db
      .update(adAccounts)
      .set({ formaPagamentoManual: forma, updatedAt: new Date() })
      .where(eq(adAccounts.id, adAccountId))
    revalidatePath('/verbas')
    return { data: { ok: true } }
  } catch (err) {
    console.error('[atualizarFormaPagamentoConta] Erro (migration 0042 pendente?):', err)
    return { error: 'Nao foi possivel salvar a forma de pagamento.' }
  }
}
