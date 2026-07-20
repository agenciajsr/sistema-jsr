/**
 * Visão executiva do financeiro — churn, LTV e ranking de motivos de
 * encerramento. Módulo PURO de propósito (zero import de db/auth/react),
 * seguindo a decisão do quick-260714-ita: matemática financeira testável
 * sem banco, consumida por actions e UI.
 *
 * PREMISSA DO LTV (documentada e exportada em PREMISSA_LTV):
 * - Clientes ENCERRADOS contam vida do início (data do primeiro contrato)
 *   até data_encerramento.
 * - Clientes ATIVOS contam vida até hoje e ENTRAM no cálculo — com ~10
 *   clientes, considerar só encerrados deixaria o número vazio/oscilante.
 * - Mês comercial de 30 dias; vida mínima de 1 mês (cliente que entrou
 *   ontem não zera a média).
 * - Ticket médio = média do valor_mensal do contrato mais recente de cada
 *   cliente com ticket conhecido.
 *
 * Datas são strings 'YYYY-MM-DD' comparadas lexicograficamente (ISO) —
 * nunca new Date() para comparação (evita fuso).
 */

export const PREMISSA_LTV =
  'Vida média (encerrados: início→encerramento; ativos: início→hoje; mínimo 1 mês, mês de 30 dias) × ticket mensal médio.'

export type ClienteVida = {
  id: string
  status: string
  /** Data de entrada na base (min data_inicio dos contratos; fallback created_at). */
  inicio: string | null
  dataEncerramento: string | null
  motivoEncerramento: string | null
  /** valor_mensal do contrato mais recente do cliente (null = desconhecido). */
  ticketMensal: number | null
}

export type ResultadoChurn = {
  encerrados: number
  /** Clientes ativos no início da janela (base do cálculo). */
  base: number
  /** null quando base === 0 — nunca divisão por zero. */
  percentual: number | null
}

function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** Primeiro dia do mês 'YYYY-MM' como 'YYYY-MM-DD'. */
function primeiroDia(mes: string): string {
  return `${mes}-01`
}

/** Mês 'YYYY-MM' deslocado em `delta` meses (delta pode ser negativo). */
function deslocarMes(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) + delta
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${novoAno}-${String(novoMes).padStart(2, '0')}`
}

/** Último dia (string ISO) do mês 'YYYY-MM'. */
function ultimoDia(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  const dia = new Date(Date.UTC(ano, m, 0)).getUTCDate()
  return `${mes}-${String(dia).padStart(2, '0')}`
}

/**
 * Cliente conta na base "ativos no início de `data`" se entrou ANTES dessa
 * data e não estava encerrado antes dela. Encerrado sem data de
 * encerramento fica FORA da base (não dá para saber quando saiu).
 */
function ativoNoInicioDe(c: ClienteVida, data: string): boolean {
  if (c.inicio == null || c.inicio >= data) return false
  if (c.dataEncerramento != null) return c.dataEncerramento >= data
  return c.status !== 'encerrado'
}

function calcularChurn(
  clientes: ClienteVida[],
  inicioJanela: string,
  fimJanela: string,
): ResultadoChurn {
  const base = clientes.filter((c) => ativoNoInicioDe(c, inicioJanela)).length
  // Só a data de encerramento define churn — status 'encerrado' sem data não conta.
  const encerrados = clientes.filter(
    (c) =>
      c.dataEncerramento != null &&
      c.dataEncerramento >= inicioJanela &&
      c.dataEncerramento <= fimJanela,
  ).length

  return {
    encerrados,
    base,
    percentual: base === 0 ? null : arredondar2((encerrados / base) * 100),
  }
}

/** Churn do mês 'YYYY-MM': encerrados no mês / ativos no 1º dia do mês. */
export function taxaDeChurn(clientes: ClienteVida[], mes: string): ResultadoChurn {
  return calcularChurn(clientes, primeiroDia(mes), ultimoDia(mes))
}

/**
 * Churn acumulado em uma janela de `meses` meses TERMINANDO em `mesFinal`
 * (inclusive): encerrados na janela / ativos no início da janela.
 */
export function churnAcumulado(
  clientes: ClienteVida[],
  mesFinal: string,
  meses: number,
): ResultadoChurn {
  const mesInicial = deslocarMes(mesFinal, -(meses - 1))
  return calcularChurn(clientes, primeiroDia(mesInicial), ultimoDia(mesFinal))
}

const MS_POR_DIA = 24 * 60 * 60 * 1000
const DIAS_POR_MES = 30 // mês comercial — premissa documentada no topo

function diasEntre(inicio: string, fim: string): number {
  return Math.max(0, (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / MS_POR_DIA)
}

/** Vida em meses (mínimo 1) de um cliente até `hoje` ou até o encerramento. */
function mesesDeVida(c: ClienteVida, hoje: string): number | null {
  if (c.inicio == null) return null
  const fim = c.dataEncerramento ?? hoje
  return Math.max(1, diasEntre(c.inicio, fim) / DIAS_POR_MES)
}

export type ResultadoLtv = {
  /** LTV médio em R$: vida média × ticket médio. */
  valor: number
  vidaMediaMeses: number
  ticketMedio: number
}

/**
 * LTV médio = vida média em meses × ticket mensal médio (ver PREMISSA_LTV).
 * null quando não há nenhum cliente com início conhecido OU nenhum ticket
 * conhecido — nunca inventa número.
 */
export function ltvMedio(clientes: ClienteVida[], hoje: string): ResultadoLtv | null {
  const vidas = clientes
    .map((c) => mesesDeVida(c, hoje))
    .filter((v): v is number => v != null)
  const tickets = clientes
    .map((c) => c.ticketMensal)
    .filter((t): t is number => t != null && t > 0)

  if (vidas.length === 0 || tickets.length === 0) return null

  const vidaMediaMeses = arredondar2(vidas.reduce((s, v) => s + v, 0) / vidas.length)
  const ticketMedio = arredondar2(tickets.reduce((s, t) => s + t, 0) / tickets.length)

  return {
    valor: arredondar2(vidaMediaMeses * ticketMedio),
    vidaMediaMeses,
    ticketMedio,
  }
}

export type MotivoRanking = { motivo: string; quantidade: number }

/**
 * Ranking de motivos de encerramento: agrupa por motivo normalizado (trim +
 * case-insensitive, exibindo a grafia da primeira ocorrência), ordena por
 * contagem desc; ignora null/vazio.
 */
export function rankingMotivos(clientes: ClienteVida[]): MotivoRanking[] {
  const grupos = new Map<string, MotivoRanking>()

  for (const c of clientes) {
    const bruto = c.motivoEncerramento?.trim()
    if (!bruto) continue
    const chave = bruto.toLowerCase()
    const existente = grupos.get(chave)
    if (existente) existente.quantidade += 1
    else grupos.set(chave, { motivo: bruto, quantidade: 1 })
  }

  return [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade)
}
