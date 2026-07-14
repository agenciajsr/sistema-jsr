// Módulo PURO: zero import de db/auth/react/next.
// Mesma filosofia de src/lib/financeiro/calculos.ts — toda a matemática e o
// merge dos agregados moram aqui, testáveis sem banco, e importáveis também
// pelo client component da lista (filtro/contagem rodam no browser).

export type ClienteStatus = 'ativo' | 'aguardando_inicio' | 'em_aviso' | 'pausado' | 'encerrado'

export type ClienteLinha = {
  id: string
  nome: string
  status: ClienteStatus
  responsavelNome: string | null
  mensalidade: number
  ltDias: number
  ltv: number
  alertasAbertos: number
  investimento30d: number
}

/** Ordem EXATA das abas (D-01 do pedido). */
export const STATUS_ORDEM: ClienteStatus[] = [
  'ativo',
  'aguardando_inicio',
  'em_aviso',
  'pausado',
  'encerrado',
]

/** Rótulos no PLURAL — usados nas abas. O badge da linha usa o singular. */
export const STATUS_LABEL: Record<ClienteStatus, string> = {
  ativo: 'Ativos',
  aguardando_inicio: 'Aguardando Início',
  em_aviso: 'Em Aviso',
  pausado: 'Pausados',
  encerrado: 'Inativos',
}

// Tipos das linhas cruas vindas das queries agregadas de lista.ts.
export type BaseRow = {
  id: string
  nome: string
  status: ClienteStatus
  createdAt: Date
  responsavelNome: string | null
}
type Agregado<K extends string, V> = ({ clienteId: string | null } & Record<K, V>)[]

const MS_POR_DIA = 86_400_000

/** Number() blindado: string do postgres, null, undefined e NaN viram 0. */
function num(v: unknown): number {
  return Number(v ?? 0) || 0
}

/** Indexa um agregado por clienteId, ignorando linhas sem cliente. */
function indexar<K extends string, V>(linhas: Agregado<K, V>, campo: K): Map<string, V> {
  const mapa = new Map<string, V>()
  for (const linha of linhas) {
    if (linha.clienteId) mapa.set(linha.clienteId, linha[campo])
  }
  return mapa
}

/**
 * Tempo de casa em dias. Base = contrato mais antigo, ou createdAt se o cliente
 * ainda não tem contrato. Ancora em meio-dia UTC para não sofrer com DST —
 * mesmo truque de dataMenosDias em src/lib/date-br.ts. Nunca negativo.
 */
export function calcularLtDias(
  dataInicioMaisAntiga: string | null,
  createdAtIso: string,
  hoje: string
): number {
  const base = dataInicioMaisAntiga ?? createdAtIso.slice(0, 10)
  const inicio = new Date(`${base}T12:00:00Z`).getTime()
  const fim = new Date(`${hoje}T12:00:00Z`).getTime()
  if (Number.isNaN(inicio) || Number.isNaN(fim)) return 0
  return Math.max(0, Math.round((fim - inicio) / MS_POR_DIA))
}

/**
 * Merge dos agregados na base. A BASE MANDA: agregado órfão (clienteId que não
 * está na base) é ignorado, nunca cria linha fantasma. Todo campo ausente vira
 * 0 — jamais undefined/NaN na UI.
 */
export function montarLinhas(
  base: BaseRow[],
  mensalidades: Agregado<'valor', string | null>,
  inicios: Agregado<'inicio', string | null>,
  ltvs: Agregado<'total', string | null>,
  alertas: Agregado<'total', number | null>,
  investimentos: Agregado<'total', string | null>,
  hoje: string
): ClienteLinha[] {
  const porMensalidade = indexar(mensalidades, 'valor')
  const porInicio = indexar(inicios, 'inicio')
  const porLtv = indexar(ltvs, 'total')
  const porAlertas = indexar(alertas, 'total')
  const porInvestimento = indexar(investimentos, 'total')

  return base.map((cliente) => ({
    id: cliente.id,
    nome: cliente.nome,
    status: cliente.status,
    responsavelNome: cliente.responsavelNome ?? null,
    mensalidade: num(porMensalidade.get(cliente.id)),
    ltDias: calcularLtDias(
      porInicio.get(cliente.id) ?? null,
      cliente.createdAt.toISOString(),
      hoje
    ),
    ltv: num(porLtv.get(cliente.id)),
    alertasAbertos: num(porAlertas.get(cliente.id)),
    investimento30d: num(porInvestimento.get(cliente.id)),
  }))
}

/** Filtro client-side (≈45 clientes): aba (status) AND busca por nome. */
export function filtrarClientes(
  linhas: ClienteLinha[],
  { busca, aba }: { busca: string; aba: ClienteStatus | 'todos' }
): ClienteLinha[] {
  const termo = busca.trim().toLowerCase()
  return linhas.filter((linha) => {
    if (aba !== 'todos' && linha.status !== aba) return false
    if (termo && !linha.nome.toLowerCase().includes(termo)) return false
    return true
  })
}

/** Contagem por status + total. TODAS as chaves presentes (0, não undefined). */
export function contarPorStatus(
  linhas: ClienteLinha[]
): Record<ClienteStatus, number> & { todos: number } {
  const contagens = {
    ativo: 0,
    aguardando_inicio: 0,
    em_aviso: 0,
    pausado: 0,
    encerrado: 0,
    todos: linhas.length,
  }
  for (const linha of linhas) {
    contagens[linha.status] += 1
  }
  return contagens
}
