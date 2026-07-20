/**
 * CAC por canal e relação LTV/CAC — módulo PURO (zero import de db/auth/react),
 * seguindo a decisão do quick-260714-ita: matemática financeira testável sem
 * banco, consumida por actions e UI (espelho de src/lib/financeiro/executiva.ts).
 *
 * PREMISSA DO CAC (documentada e exportada em PREMISSA_CAC):
 * - "canal" é uma LISTA CANÔNICA nossa (CANAIS_AQUISICAO). O investimento é
 *   lançado por (canal, competência) na tela de Aquisição.
 * - A origem do cliente (clientes.origem_cliente) é TEXTO LIVRE ("Como conheceu
 *   a agência?") — não há enum. Por isso os clientes são casados aos canais por
 *   um CLASSIFICADOR heurístico (keyword + fallback 'outro'), documentado como
 *   premissa. Trocar a heurística = mexer só em classificarCanal.
 * - "cliente ganho no período" = cliente cujo `inicio` (min data_inicio dos
 *   contratos; fallback created_at) cai dentro da competência.
 * - CAC do canal = investimento do canal no período ÷ clientes ganhos do canal.
 *   Canal com investimento mas SEM cliente ganho fica com CAC INDEFINIDO (null),
 *   nunca 0 e nunca divisão por zero — com ~10 clientes isso é o caso comum.
 *
 * Datas são strings ISO ('YYYY-MM-DD') e competências 'YYYY-MM' comparadas
 * LEXICOGRAFICAMENTE — nunca new Date() para comparação (evita fuso).
 */

export const PREMISSA_CAC =
  'CAC do canal = investimento do canal no período ÷ clientes ganhos (início na competência) classificados nesse canal (origem é texto livre, casada por heurística); canal sem cliente ganho fica indefinido.'

export const PREMISSA_CAC_ATRIBUICAO =
  'Canal atribuído por origem estruturada do CRM (oportunidade vinculada → contato vinculado, mapeadas por canalDaOrigemCrm); reserva no texto livre clientes.origem_cliente via classificarCanal quando não há vínculo ou a origem estruturada não identifica canal pago; Google não existe no CRM, só chega pela reserva; fallback final "outro".'

export const CANAIS_AQUISICAO = [
  'meta_ads',
  'google_ads',
  'indicacao',
  'organico',
  'prospeccao',
  'outro',
] as const

export type CanalAquisicao = (typeof CANAIS_AQUISICAO)[number]

export const ROTULO_CANAL: Record<CanalAquisicao, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  indicacao: 'Indicação',
  organico: 'Orgânico',
  prospeccao: 'Prospecção',
  outro: 'Outro',
}

export type InvestimentoCanal = {
  canal: string
  /** competência 'YYYY-MM' */
  competencia: string
  valor: number
}

export type ClienteGanho = {
  /** clientes.origem_cliente (texto livre) — reserva quando o CRM não resolve. */
  origem: string | null
  /**
   * Origem estruturada resolvida do CRM (oportunidade → contato). undefined/null
   * = sem vínculo, cai na reserva do texto livre. Opcional: preserva os testes
   * antigos que passam só `origem`.
   */
  origemCrm?: string | null
  /** 'YYYY-MM-DD' (min data_inicio; fallback created_at). null = ignorado. */
  inicio: string | null
}

export type CacCanal = {
  canal: CanalAquisicao
  investimento: number
  clientesGanhos: number
  /** null quando clientesGanhos === 0 (indefinido — nunca ÷0, nunca 0). */
  cac: number | null
}

export type ResultadoCac = {
  porCanal: CacCanal[]
  investimentoTotal: number
  clientesGanhosTotal: number
  /** total investido ÷ total de clientes ganhos; null se nenhum ganho. */
  cacGeral: number | null
}

function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** trim + lowercase + remoção de acentos, para casar keywords. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Mês 'YYYY-MM' deslocado em `delta` meses (delta pode ser negativo). */
function deslocarMes(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) + delta
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${novoAno}-${String(novoMes).padStart(2, '0')}`
}

// Regras keyword → canal, avaliadas EM ORDEM (primeira que casa vence). A ordem
// evita ambiguidade: indicação/prospecção antes das mídias pagas; 'ads' NÃO é
// keyword de meta (a substring aparece em "leads") — usamos 'anuncio'/rede.
const REGRAS_CANAL: [CanalAquisicao, string[]][] = [
  // 'indic' (não 'indica') captura indicação/indicado/indicou — a reserva de
  // texto livre da cadeia do CRM precisa reconhecer "Amigo indicou".
  ['indicacao', ['indic']],
  ['prospeccao', ['prospec', 'outbound', 'cold']],
  ['google_ads', ['google', 'pesquisa', 'search', 'adwords']],
  ['meta_ads', ['instagram', 'insta', 'facebook', 'face', 'meta', 'anuncio']],
  ['organico', ['organico', 'site', 'seo', 'blog', 'youtube', 'tiktok', 'perfil']],
]

/**
 * Classifica a origem (texto livre) num canal canônico por keyword. Heurística
 * com fallback 'outro' — documentada como premissa (origem_cliente não é enum).
 */
export function classificarCanal(origem: string | null): CanalAquisicao {
  if (!origem) return 'outro'
  const t = normalizar(origem)
  if (!t) return 'outro'
  for (const [canal, keywords] of REGRAS_CANAL) {
    if (keywords.some((k) => t.includes(k))) return canal
  }
  return 'outro'
}

// Mapa EXPLÍCITO das origens canônicas do CRM (src/lib/crm/origem.ts) para os
// canais de aquisição. Só as origens que identificam um canal aparecem aqui;
// qualquer outra (landing_page, whatsapp, evento, parceria, manual, outro,
// desconhecida) cai para null e deixa a reserva do texto livre decidir.
// IMPORTANTE: Google Ads NÃO existe como origem no CRM — por isso o modelo é
// híbrido: cliente vindo do Google é captado só pela reserva de texto livre
// (keyword 'google' já tratada em classificarCanal).
const MAPA_ORIGEM_CRM: Record<string, CanalAquisicao> = {
  meta_lead_ad: 'meta_ads', // Meta PAGO (lead ad)
  indicacao: 'indicacao',
  prospeccao_fria: 'prospeccao',
  instagram: 'organico', // Instagram ORGÂNICO (o pago é meta_lead_ad)
}

/**
 * Mapeia a origem ESTRUTURADA do CRM num canal canônico. Retorna null quando a
 * origem não identifica um canal (deixando a reserva de texto livre decidir) ou
 * quando não há origem/valor conhecido.
 */
export function canalDaOrigemCrm(origemCrm: string | null): CanalAquisicao | null {
  if (!origemCrm) return null
  return MAPA_ORIGEM_CRM[origemCrm] ?? null
}

/**
 * CADEIA/RESERVA de atribuição de canal (ver PREMISSA_CAC_ATRIBUICAO): tenta
 * PRIMEIRO a origem estruturada do CRM; se ela não resolve (sem vínculo ou
 * origem que não identifica canal pago), cai no classificador do texto livre —
 * que já garante o fallback 'outro'.
 */
export function resolverCanalCliente(
  origemCrm: string | null,
  origemTextoLivre: string | null,
): CanalAquisicao {
  return canalDaOrigemCrm(origemCrm) ?? classificarCanal(origemTextoLivre)
}

/** Competência 'YYYY-MM' do início de um cliente ('YYYY-MM-DD'). */
function competenciaDoInicio(inicio: string): string {
  return inicio.slice(0, 7)
}

/**
 * Núcleo do cálculo: agrega investimento e clientes ganhos por canal para as
 * competências `dentroDaJanela` (predicado sobre 'YYYY-MM'), montando SEMPRE
 * todos os canais canônicos (mesmo zerados — o número não some da tela).
 */
function agregar(
  investimentos: InvestimentoCanal[],
  clientesGanhos: ClienteGanho[],
  dentroDaJanela: (competencia: string) => boolean,
): ResultadoCac {
  const investPorCanal = new Map<CanalAquisicao, number>()
  const ganhosPorCanal = new Map<CanalAquisicao, number>()
  for (const c of CANAIS_AQUISICAO) {
    investPorCanal.set(c, 0)
    ganhosPorCanal.set(c, 0)
  }

  let investimentoTotal = 0
  for (const i of investimentos) {
    if (!dentroDaJanela(i.competencia)) continue
    const canal = (CANAIS_AQUISICAO as readonly string[]).includes(i.canal)
      ? (i.canal as CanalAquisicao)
      : 'outro'
    investPorCanal.set(canal, (investPorCanal.get(canal) ?? 0) + i.valor)
    investimentoTotal += i.valor
  }

  let clientesGanhosTotal = 0
  for (const cliente of clientesGanhos) {
    if (cliente.inicio == null) continue
    if (!dentroDaJanela(competenciaDoInicio(cliente.inicio))) continue
    const canal = resolverCanalCliente(cliente.origemCrm ?? null, cliente.origem)
    ganhosPorCanal.set(canal, (ganhosPorCanal.get(canal) ?? 0) + 1)
    clientesGanhosTotal += 1
  }

  const porCanal: CacCanal[] = CANAIS_AQUISICAO.map((canal) => {
    const investimento = arredondar2(investPorCanal.get(canal) ?? 0)
    const ganhos = ganhosPorCanal.get(canal) ?? 0
    return {
      canal,
      investimento,
      clientesGanhos: ganhos,
      cac: ganhos === 0 ? null : arredondar2(investimento / ganhos),
    }
  })

  return {
    porCanal,
    investimentoTotal: arredondar2(investimentoTotal),
    clientesGanhosTotal,
    cacGeral:
      clientesGanhosTotal === 0
        ? null
        : arredondar2(investimentoTotal / clientesGanhosTotal),
  }
}

/** CAC por canal na competência 'YYYY-MM' (mês fechado sobre si mesmo). */
export function cacPorCanal(
  investimentos: InvestimentoCanal[],
  clientesGanhos: ClienteGanho[],
  competencia: string,
): ResultadoCac {
  return agregar(investimentos, clientesGanhos, (c) => c === competencia)
}

/**
 * CAC acumulado numa janela de `meses` meses TERMINANDO em `mesFinal`
 * (inclusive) — espelho de churnAcumulado. Ex.: (…, '2026-07', 3) = mai+jun+jul.
 */
export function cacAcumulado(
  investimentos: InvestimentoCanal[],
  clientesGanhos: ClienteGanho[],
  mesFinal: string,
  meses: number,
): ResultadoCac {
  const mesInicial = deslocarMes(mesFinal, -(meses - 1))
  return agregar(
    investimentos,
    clientesGanhos,
    (c) => c >= mesInicial && c <= mesFinal,
  )
}

/**
 * Relação LTV/CAC (quantas vezes o retorno cobre o custo de aquisição).
 * null quando o LTV é desconhecido OU o CAC geral é 0/null (nunca ÷0).
 */
export function relacaoLtvCac(
  ltvValor: number | null,
  cacGeral: number | null,
): number | null {
  if (ltvValor == null || cacGeral == null || cacGeral === 0) return null
  return arredondar2(ltvValor / cacGeral)
}
