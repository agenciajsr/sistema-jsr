// Módulo PURO: zero import de db/auth/react/next.
// Mesma filosofia de src/lib/clientes/agregar.ts e de ./recorrencia (que é a
// única dependência daqui, e também é pura): toda a regra de apresentação do
// quadro mora aqui, testável sem banco, e importável pelos client components.
//
// D-05: o server manda a lista CRUA. Agrupamento por status, estatísticas e %
// são calculados aqui, no client — busca/prioridade/filtros ficam instantâneos,
// sem round-trip. Mesmo desenho de clientes-lista.tsx + agregar.ts.
//
// ⚠️ Datas SEMPRE como string 'YYYY-MM-DD'. Nada de `new Date()` para formatar:
// o fuso da máquina do usuário empurraria a data para o dia vizinho.

import { somaDias, type TarefaStatus, type TarefaPrioridade } from './recorrencia'

// --- As 4 colunas (D-02) ---

/** Ordem EXATA das colunas do quadro (mockup 1). */
export const COLUNAS_ORDEM: TarefaStatus[] = [
  'a_fazer',
  'em_andamento',
  'concluida',
  'nao_realizada',
]

export const COLUNA_LABEL: Record<TarefaStatus, string> = {
  a_fazer: 'Pendentes',
  em_andamento: 'Em Andamento',
  concluida: 'Concluídas',
  nao_realizada: 'Não Feitas',
}

/** Helper abaixo do número, na barra de estatísticas do rodapé. */
export const COLUNA_HELPER: Record<TarefaStatus, string> = {
  a_fazer: 'Para fazer',
  em_andamento: 'Em progresso',
  concluida: 'Finalizadas',
  nao_realizada: 'Canceladas',
}

// D-02: só tokens que JÁ existem em globals.css — zero cor nova inventada.
/** Classe da bolinha do cabeçalho da coluna. */
export const COLUNA_PONTO: Record<TarefaStatus, string> = {
  a_fazer: 'bg-chart-warning',
  em_andamento: 'bg-primary',
  concluida: 'bg-chart-success',
  nao_realizada: 'bg-muted-foreground',
}

/** Classe da linha colorida no topo da coluna. */
export const COLUNA_BARRA: Record<TarefaStatus, string> = {
  a_fazer: 'bg-chart-warning',
  em_andamento: 'bg-primary',
  concluida: 'bg-chart-success',
  nao_realizada: 'bg-muted-foreground',
}

/** D-03: chip suave; `urgente` é o ÚNICO sólido. */
export const PRIORIDADE_CLASSE: Record<TarefaPrioridade, string> = {
  urgente: 'bg-destructive text-white border-transparent',
  alta: 'bg-destructive/10 text-destructive border-destructive/20',
  media: 'bg-chart-warning/10 text-chart-warning border-chart-warning/20',
  baixa: 'bg-chart-success/10 text-chart-success border-chart-success/20',
}

// --- Agrupamento e estatísticas ---

export type EstatisticasQuadro = {
  total: number
  porStatus: Record<TarefaStatus, number>
  percentualConclusao: number
}

/**
 * Agrupa por status. As 4 chaves existem SEMPRE (mesmo vazias): a coluna vazia
 * precisa renderizar cabeçalho + "Adicionar tarefa" — nunca pode sumir.
 */
export function agruparPorStatus<T extends { status: TarefaStatus }>(
  tarefas: T[]
): Record<TarefaStatus, T[]> {
  const grupos = {
    a_fazer: [] as T[],
    em_andamento: [] as T[],
    concluida: [] as T[],
    nao_realizada: [] as T[],
  }
  for (const tarefa of tarefas) {
    // Status desconhecido (enum novo no banco) não derruba o quadro.
    const coluna = grupos[tarefa.status]
    if (coluna) coluna.push(tarefa)
  }
  return grupos
}

/** D-06: reflete o que está VISÍVEL (pós-filtro), coerente com os contadores. */
export function estatisticasDoQuadro(tarefas: { status: TarefaStatus }[]): EstatisticasQuadro {
  const porStatus: Record<TarefaStatus, number> = {
    a_fazer: 0,
    em_andamento: 0,
    concluida: 0,
    nao_realizada: 0,
  }
  for (const tarefa of tarefas) {
    if (porStatus[tarefa.status] !== undefined) porStatus[tarefa.status] += 1
  }
  const total = COLUNAS_ORDEM.reduce((acc, s) => acc + porStatus[s], 0)
  return { total, porStatus, percentualConclusao: percentualConclusao(porStatus.concluida, total) }
}

/** Guarda de divisão por zero: lista vazia devolve 0, nunca NaN. */
export function percentualConclusao(concluidas: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((concluidas / total) * 100)
}

/** Progresso do checklist em %. 0 quando não há itens. */
export function progressoChecklist(feitos: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((feitos / total) * 100)
}

// --- Código, avatar ---

/**
 * D-04: o código real é coluna GERADA no banco a partir de `codigo_num`
 * (identity). Esta função é o espelho puro dela — para exibição e fallback.
 */
export function codigoTarefa(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'TAR-—'
  return `TAR-${String(n).padStart(4, '0')}`
}

/**
 * 2 letras maiúsculas: primeira + segunda palavra ('Ana Paula' → 'AP');
 * nome único usa as 2 primeiras letras ('Jacson' → 'JA'). Nunca quebra.
 */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

// Só tokens existentes — nada de paleta nova.
const PALETA_AVATAR = [
  'bg-primary/15 text-primary',
  'bg-chart-success/15 text-chart-success',
  'bg-chart-warning/15 text-chart-warning',
  'bg-destructive/15 text-destructive',
]

/**
 * Cor estável por id: hash simples (soma de charCodes) módulo a paleta.
 * DETERMINÍSTICO de propósito — o mesmo responsável tem sempre a mesma cor,
 * em qualquer render, sem estado nem banco.
 */
export function corDoAvatar(id: string | null | undefined): string {
  const chave = id ?? ''
  let soma = 0
  for (let i = 0; i < chave.length; i++) soma += chave.charCodeAt(i)
  return PALETA_AVATAR[soma % PALETA_AVATAR.length]
}

// --- Checklist agrupado (D-08) ---

export type GrupoChecklist<T> = { nome: string; itens: T[]; total: number; feitos: number }

/**
 * Agrupa os itens por `grupo`, preservando a ordem de PRIMEIRA aparição
 * (a query já vem ordenada por grupo, ordem).
 */
export function agruparChecklist<T extends { grupo: string; concluido: boolean }>(
  itens: T[]
): GrupoChecklist<T>[] {
  const porNome = new Map<string, GrupoChecklist<T>>()
  for (const item of itens) {
    const nome = item.grupo || 'Checklist'
    let grupo = porNome.get(nome)
    if (!grupo) {
      grupo = { nome, itens: [], total: 0, feitos: 0 }
      porNome.set(nome, grupo)
    }
    grupo.itens.push(item)
    grupo.total += 1
    if (item.concluido) grupo.feitos += 1
  }
  return [...porNome.values()]
}

// --- Filtros (client-side, D-05/D-07) ---

/** Sentinela 'todas'/'todos': Radix não aceita `value=""` em Select/Item. */
export type FiltroQuadro = {
  busca?: string
  prioridade?: TarefaPrioridade | 'todas'
  clienteId?: string | 'todos'
  responsavelId?: string | 'todos'
}

type TarefaFiltravel = {
  titulo: string
  prioridade: TarefaPrioridade
  clienteId: string | null
  responsavelId: string | null
}

/** Minúsculas + sem acento: "anuncio" acha "Anúncio". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Todos os filtros combinam com E lógico. Ausente/sentinela = não filtra. */
export function filtrarTarefas<T extends TarefaFiltravel>(tarefas: T[], filtro: FiltroQuadro): T[] {
  const termo = normalizar((filtro.busca ?? '').trim())
  const { prioridade, clienteId, responsavelId } = filtro

  return tarefas.filter((tarefa) => {
    if (termo && !normalizar(tarefa.titulo).includes(termo)) return false
    if (prioridade && prioridade !== 'todas' && tarefa.prioridade !== prioridade) return false
    if (clienteId && clienteId !== 'todos' && tarefa.clienteId !== clienteId) return false
    if (responsavelId && responsavelId !== 'todos' && tarefa.responsavelId !== responsavelId) {
      return false
    }
    return true
  })
}

// --- Intervalo (D-01) ---

/**
 * D-01: 7 dias começando em HOJE — NÃO é semana calendário.
 * O mockup mostra "14/07/2026 - 20/07/2026" e 14/07/2026 é uma terça.
 */
export function intervaloPadrao(hoje: string): { inicio: string; fim: string } {
  return { inicio: hoje, fim: somaDias(hoje, 6) }
}

/** 'YYYY-MM-DD' → 'dd/MM/yyyy', direto da string. Nunca via `new Date()`. */
function paraBR(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

/** '14/07/2026 - 20/07/2026' — o rótulo do intervalo na toolbar. */
export function formatarIntervalo(inicio: string, fim: string): string {
  return `${paraBR(inicio)} - ${paraBR(fim)}`
}
