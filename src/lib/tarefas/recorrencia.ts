// Módulo PURO: zero import de db/auth/react/next.
// Mesma filosofia de src/lib/clientes/agregar.ts — toda a regra de calendário
// mora aqui, testável sem banco, e importável também pelos client components
// (os rótulos em pt-BR e os tipos são usados na UI).
//
// ⚠️ Datas SEMPRE como string 'YYYY-MM-DD'. Toda a aritmética é ancorada em
// MEIO-DIA UTC (mesmo truque de dataMenosDias em src/lib/date-br.ts): assim
// nenhuma borda de fuso/DST consegue empurrar a data para o dia vizinho.

export type TarefaRecorrencia =
  | 'nenhuma'
  | 'diaria'
  | 'semanal'
  | 'mensal'
  | 'anual'
  | 'dia_sim_dia_nao'
  | 'dias_uteis'
  | 'personalizada'

export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'concluida' | 'nao_realizada'

export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente'

/** A regra de recorrência de um molde. `recorrenciaDias` só vale p/ 'personalizada'. */
export type RegraRecorrencia = {
  recorrencia: TarefaRecorrencia
  /** 0=domingo … 6=sábado. Vazio/ausente em 'personalizada' ⇒ nunca ocorre. */
  recorrenciaDias?: number[] | null
}

export const RECORRENCIA_LABEL: Record<TarefaRecorrencia, string> = {
  nenhuma: 'Não se repete',
  diaria: 'Todos os dias',
  semanal: 'Toda semana',
  mensal: 'Todo mês',
  anual: 'Todo ano',
  dia_sim_dia_nao: 'Dia sim, dia não',
  dias_uteis: 'Dias úteis (seg a sex)',
  personalizada: 'Personalizada',
}

export const STATUS_LABEL: Record<TarefaStatus, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  nao_realizada: 'Não realizada',
}

export const PRIORIDADE_LABEL: Record<TarefaPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

/** Ordem de exibição da prioridade (também usada no ORDER BY conceitual). */
export const PRIORIDADE_ORDEM: TarefaPrioridade[] = ['urgente', 'alta', 'media', 'baixa']

/** Rótulos curtos dos dias da semana, índice = getUTCDay(). */
export const DIAS_SEMANA_LABEL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const DIAS_SEMANA_NOME = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

// --- Helpers de data (todos ancorados em meio-dia UTC) ---

function parse(data: string): Date {
  return new Date(`${data}T12:00:00Z`)
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Soma (ou subtrai, com n negativo) dias a uma data 'YYYY-MM-DD'. */
export function somaDias(data: string, n: number): string {
  const d = parse(data)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

/** Diferença em dias inteiros entre duas datas 'YYYY-MM-DD' (b - a). */
export function diffDias(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}

/** Dia da semana (0=domingo … 6=sábado) de uma data 'YYYY-MM-DD'. */
export function diaDaSemana(data: string): number {
  return parse(data).getUTCDay()
}

/** Último dia do mês em que a data cai (28/29/30/31). */
function ultimoDiaDoMes(data: string): number {
  const d = parse(data)
  // Dia 0 do mês seguinte == último dia do mês atual.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

/**
 * O dia do mês que a regra mira em `data`, GRAMPEADO no último dia do mês:
 * um molde do dia 31 mira o dia 28 em fevereiro — nunca vaza para 03/03.
 */
function diaAlvoGrampeado(diaDoMolde: number, data: string): number {
  return Math.min(diaDoMolde, ultimoDiaDoMes(data))
}

// --- A engine ---

/**
 * A regra `regra` (de um molde datado em `dataMolde`) ocorre em `data`?
 * NUNCA ocorre antes do molde — a série começa no dia em que foi criada.
 */
export function ocorreEm(regra: RegraRecorrencia, dataMolde: string, data: string): boolean {
  // Guarda universal: nada acontece antes do nascimento da série.
  if (data < dataMolde) return false

  const molde = parse(dataMolde)
  const alvo = parse(data)

  switch (regra.recorrencia) {
    case 'nenhuma':
      // Tarefa avulsa não gera série nenhuma.
      return false

    case 'diaria':
      return true

    case 'dias_uteis': {
      const dow = alvo.getUTCDay()
      return dow >= 1 && dow <= 5
    }

    case 'dia_sim_dia_nao':
      // Paridade pela DIFERENÇA contra o molde, nunca pelo dia do mês
      // (senão a virada de mês com 31 dias quebraria a alternância).
      return diffDias(dataMolde, data) % 2 === 0

    case 'semanal':
      return alvo.getUTCDay() === molde.getUTCDay()

    case 'personalizada': {
      const dias = regra.recorrenciaDias
      if (!dias || dias.length === 0) return false
      return dias.includes(alvo.getUTCDay())
    }

    case 'mensal':
      return alvo.getUTCDate() === diaAlvoGrampeado(molde.getUTCDate(), data)

    case 'anual':
      return (
        alvo.getUTCMonth() === molde.getUTCMonth() &&
        alvo.getUTCDate() === diaAlvoGrampeado(molde.getUTCDate(), data)
      )

    default:
      return false
  }
}

/**
 * Todas as datas em que a regra ocorre dentro de [de, ate].
 * Itera dia a dia de propósito: a janela é curta (≤ 91 dias, garantido por
 * janelaMaterializacao) e simplicidade vale mais que esperteza aqui.
 */
export function datasDaRegra(
  regra: RegraRecorrencia,
  dataMolde: string,
  de: string,
  ate: string
): string[] {
  if (ate < de) return []
  if (regra.recorrencia === 'nenhuma') return []

  // Não adianta varrer antes do molde: a guarda de ocorreEm devolveria false.
  const inicio = de < dataMolde ? dataMolde : de
  if (ate < inicio) return []

  const datas: string[] = []
  let atual = inicio
  while (atual <= ate) {
    if (ocorreEm(regra, dataMolde, atual)) datas.push(atual)
    atual = somaDias(atual, 1)
  }
  return datas
}

export type MoldeParaMaterializar = {
  /** Data de nascimento da série (a `data` do molde). */
  data: string
  recorrencia: TarefaRecorrencia
  recorrenciaDias?: number[] | null
}

/**
 * As datas da série que ainda NÃO existem no banco, dentro de [de, ate].
 *
 * Base da idempotência (D-05): chamar duas vezes seguidas, somando o resultado
 * da primeira aos `existentes`, devolve []. Abrir /tarefas 2× não duplica nada.
 * A trava final contra corrida é o índice único (tarefa_mae_id, data) no banco.
 */
export function ocorrenciasFaltantes({
  molde,
  existentes,
  de,
  ate,
}: {
  molde: MoldeParaMaterializar
  existentes: string[]
  de: string
  ate: string
}): string[] {
  const jaExiste = new Set(existentes)
  return datasDaRegra(
    { recorrencia: molde.recorrencia, recorrenciaDias: molde.recorrenciaDias },
    molde.data,
    de,
    ate
  ).filter((d) => !jaExiste.has(d))
}

/** Quantos dias para trás a materialização olha (varredura de atrasadas). */
export const JANELA_PASSADO_DIAS = 30
/** TETO de dias para frente. Impede explosão de linhas se alguém navegar p/ 2030. */
const JANELA_FUTURO_MAX_DIAS = 60

/**
 * A janela [de, ate] que a materialização preguiçosa cobre ao abrir /tarefas.
 * `de` = hoje-30 · `ate` = min(max(hoje, diaSelecionado), hoje+60).
 */
export function janelaMaterializacao(
  hoje: string,
  diaSelecionado?: string
): { de: string; ate: string } {
  const dia = diaSelecionado || hoje
  const teto = somaDias(hoje, JANELA_FUTURO_MAX_DIAS)

  // Nunca menor que hoje (dia no passado não materializa futuro)…
  const ate = dia > hoje ? dia : hoje
  return {
    de: somaDias(hoje, -JANELA_PASSADO_DIAS),
    // …e nunca além do teto.
    ate: ate > teto ? teto : ate,
  }
}
