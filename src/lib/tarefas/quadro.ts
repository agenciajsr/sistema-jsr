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

import {
  somaDias,
  JANELA_PASSADO_DIAS,
  STATUS_LABEL,
  PRIORIDADE_LABEL,
  type TarefaStatus,
  type TarefaPrioridade,
} from './recorrencia'

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
  nao_realizada: 'Não realizadas',
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

/** O status como chip do mockup ("▶ Em Andamento" azul). Só tokens existentes. */
export const STATUS_CLASSE: Record<TarefaStatus, string> = {
  a_fazer: 'bg-muted text-foreground border-transparent',
  em_andamento: 'bg-primary/10 text-primary border-primary/20',
  concluida: 'bg-chart-success/10 text-chart-success border-chart-success/20',
  nao_realizada: 'bg-muted text-muted-foreground border-transparent',
}

// Chips coloridos de etiqueta (mockup: "Google Ads" azul, "Performance" verde).
const PALETA_ETIQUETA = [
  'bg-primary/10 text-primary border-primary/20',
  'bg-chart-success/10 text-chart-success border-chart-success/20',
  'bg-chart-warning/10 text-chart-warning border-chart-warning/20',
  'bg-destructive/10 text-destructive border-destructive/20',
]

/** Cor ESTÁVEL por nome de etiqueta — mesmo hash determinístico de corDoAvatar. */
export function corDaEtiqueta(nome: string | null | undefined): string {
  const chave = nome ?? ''
  let soma = 0
  for (let i = 0; i < chave.length; i++) soma += chave.charCodeAt(i)
  return PALETA_ETIQUETA[soma % PALETA_ETIQUETA.length]
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
 * Intervalo PADRÃO do quadro: de hoje-30 (atrasadas) até HOJE — NUNCA futuro.
 * FIX-2: terminar em HOJE impede que a série recorrente materialize ocorrências
 * futuras só por abrir /tarefas. O futuro só aparece ao navegar explicitamente
 * (params de/ate na URL). Ainda mostra as atrasadas dos últimos 30 dias.
 */
export function intervaloPadrao(hoje: string): { inicio: string; fim: string } {
  return { inicio: somaDias(hoje, -JANELA_PASSADO_DIAS), fim: hoje }
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

// --- Visão diária (quick 260715-ibf) ---

/** Rótulo do botão de data: 'Hoje' quando dia === hoje, senão 'dd/MM/yyyy'. */
export function rotuloDoDia(dia: string, hoje: string): string {
  return dia === hoje ? 'Hoje' : paraBR(dia)
}

/**
 * Timestamp ISO → 'YYYY-MM-DD' no fuso America/Sao_Paulo (en-CA = ISO).
 * null/inválido → null, NUNCA lança — concluidaEm pode vir nula (legado).
 */
export function dataBrasiliaDeIso(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

type TarefaVisaoDiaria = {
  status: TarefaStatus
  data: string
  concluidaEm?: string | null
}

/**
 * O que aparece na visão de UM dia (o quadro é diário desde o quick ibf):
 * - a_fazer/em_andamento: data <= dia (atrasadas continuam visíveis)
 * - concluida: concluída NO dia visualizado (concluidaEm em fuso BR);
 *   sem concluidaEm (legado), fallback data === dia
 * - nao_realizada: só do próprio dia — não acumula lixo de dias anteriores
 */
export function tarefasDaVisaoDiaria<T extends TarefaVisaoDiaria>(tarefas: T[], dia: string): T[] {
  return tarefas.filter((tarefa) => {
    if (tarefa.status === 'a_fazer' || tarefa.status === 'em_andamento') {
      return tarefa.data <= dia
    }
    if (tarefa.status === 'concluida') {
      const concluidaEmDia = dataBrasiliaDeIso(tarefa.concluidaEm ?? null)
      return concluidaEmDia ? concluidaEmDia === dia : tarefa.data === dia
    }
    // nao_realizada (e qualquer status futuro desconhecido): só o próprio dia.
    return tarefa.data === dia
  })
}

// --- Derivados de comentário / anexo / atividade / notas (so8) ---
// Tudo PURO e determinístico: recebe o "agora" como parâmetro, nunca chama
// Date.now(). Os componentes não calculam nada — só exibem o que sai daqui.

/**
 * "há X horas" do mockup. Determinístico: `agoraIso` é sempre passado.
 * < 1 min → "agora há pouco"; < 1 h → minutos; < 1 dia → horas; < 30 dias → dias;
 * ≥ 30 dias → data 'dd/MM/yyyy'. Entrada inválida/vazia → "" (nunca lança).
 */
export function tempoRelativo(iso: string | null | undefined, agoraIso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const agora = new Date(agoraIso).getTime()
  if (!Number.isFinite(t) || !Number.isFinite(agora)) return ''

  const seg = Math.floor((agora - t) / 1000)
  if (seg < 60) return 'agora há pouco'

  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`

  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `há ${hrs} ${hrs === 1 ? 'hora' : 'horas'}`

  const dias = Math.floor(hrs / 24)
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`

  // ≥ 30 dias: data absoluta, formatada em UTC a partir do ISO (determinístico).
  const [ano, mes, dia] = new Date(iso).toISOString().slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * "Tipo • Tamanho" do card de anexos. Vírgula decimal (pt-BR), 1 casa, sem casa
 * quando inteiro. 0 → "0 KB" (caso do mockup). negativo/NaN/null → "—".
 */
export function formatarTamanho(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 KB'
  if (bytes < 1024) return `${Math.round(bytes)} B`

  const KB = 1024
  const MB = KB * 1024
  const GB = MB * 1024
  const num = (n: number) => {
    const r = Math.round(n * 10) / 10
    return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
  }
  if (bytes < MB) return `${num(bytes / KB)} KB`
  if (bytes < GB) return `${num(bytes / MB)} MB`
  return `${num(bytes / GB)} GB`
}

/** Ícone colorido por tipo de arquivo. A `classe` só usa tokens existentes. */
export type ArquivoInfo = { rotulo: string; classe: string }

// Ícones SÓLIDOS coloridos com glifo branco — exatamente como no mockup
// (quadradinho verde/vermelho/laranja), não tintados.
const ARQUIVO_POR_TIPO: Record<string, ArquivoInfo> = {
  planilha: { rotulo: 'Planilha', classe: 'bg-chart-success text-white' },
  pdf: { rotulo: 'PDF', classe: 'bg-destructive text-white' },
  apresentacao: { rotulo: 'Apresentação', classe: 'bg-chart-warning text-white' },
  imagem: { rotulo: 'Imagem', classe: 'bg-primary text-white' },
  documento: { rotulo: 'Documento', classe: 'bg-primary text-white' },
  arquivo: { rotulo: 'Arquivo', classe: 'bg-muted text-muted-foreground' },
}

const EXTENSAO_TIPO: Record<string, keyof typeof ARQUIVO_POR_TIPO> = {
  xlsx: 'planilha', xls: 'planilha', csv: 'planilha',
  pdf: 'pdf',
  pptx: 'apresentacao', ppt: 'apresentacao',
  png: 'imagem', jpg: 'imagem', jpeg: 'imagem', gif: 'imagem', webp: 'imagem', svg: 'imagem',
  docx: 'documento', doc: 'documento', txt: 'documento',
}

function tipoPorMime(mime: string): keyof typeof ARQUIVO_POR_TIPO | null {
  const m = mime.toLowerCase()
  if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return 'planilha'
  if (m.includes('pdf')) return 'pdf'
  if (m.includes('presentation') || m.includes('powerpoint')) return 'apresentacao'
  if (m.startsWith('image/') || m.includes('image')) return 'imagem'
  if (m.includes('word') || m.includes('document') || m.startsWith('text/')) return 'documento'
  return null
}

/**
 * `{ rotulo, classe }` para o ícone do anexo. A extensão ganha do mime quando
 * ambos existem; case-insensitive. Desconhecido → "Arquivo" (muted).
 */
export function tipoDeArquivo(nome: string | null | undefined, mime?: string | null): ArquivoInfo {
  const n = (nome ?? '').toLowerCase()
  const ponto = n.lastIndexOf('.')
  const ext = ponto >= 0 ? n.slice(ponto + 1) : ''

  const porExt = ext ? EXTENSAO_TIPO[ext] : undefined
  const chave = porExt ?? (mime ? tipoPorMime(mime) : null) ?? 'arquivo'
  return ARQUIVO_POR_TIPO[chave]
}

/** Tipos de atividade conhecidos. `tipo` é text livre no banco (D-03). */
export type TipoAtividade =
  | 'criou'
  | 'campo_alterado'
  | 'comentou'
  | 'anexou'
  | 'removeu_anexo'
  | 'checklist_concluido'
  | 'checklist_reaberto'

export type AtividadeEntrada = {
  tipo: string
  campo?: string | null
  de?: string | null
  para?: string | null
  detalhe?: string | null
}

// Campos que ganham frase própria fora de status/prioridade/titulo.
const CAMPO_GENERICO_LABEL: Record<string, string> = {
  data: 'o prazo',
  dataInicio: 'a data de início',
  tempoEstimado: 'o tempo estimado',
  responsavelId: 'o responsável',
  clienteId: 'o cliente',
  descricao: 'a descrição',
  notas: 'as notas',
  etiquetas: 'as etiquetas',
}

function rotuloDoValor(campo: string, valor?: string | null): string | null {
  if (!valor) return null
  if (campo === 'status') return STATUS_LABEL[valor as TarefaStatus] ?? valor
  if (campo === 'prioridade') return PRIORIDADE_LABEL[valor as TarefaPrioridade] ?? valor
  return valor
}

/**
 * A linha do card "Atividade Recente": `{ frase, valor }`. Nunca lança —
 * um `tipo` novo (versão futura) cai no genérico "atualizou a tarefa".
 */
export function textoAtividade(atv: AtividadeEntrada): { frase: string; valor: string | null } {
  switch (atv.tipo) {
    case 'criou':
      return { frase: 'criou a tarefa', valor: null }
    case 'comentou':
      return { frase: 'comentou', valor: atv.detalhe ?? null }
    case 'anexou':
      return { frase: 'anexou um arquivo', valor: atv.detalhe ?? null }
    case 'removeu_anexo':
      return { frase: 'removeu um arquivo', valor: atv.detalhe ?? null }
    case 'checklist_concluido':
      return { frase: 'concluiu o item', valor: atv.detalhe ?? null }
    case 'checklist_reaberto':
      return { frase: 'reabriu o item', valor: atv.detalhe ?? null }
    case 'campo_alterado': {
      const campo = atv.campo ?? ''
      if (campo === 'titulo') return { frase: 'renomeou a tarefa', valor: null }
      if (campo === 'status') return { frase: 'alterou o status para', valor: rotuloDoValor('status', atv.para) }
      if (campo === 'prioridade') return { frase: 'alterou a prioridade para', valor: rotuloDoValor('prioridade', atv.para) }
      const label = CAMPO_GENERICO_LABEL[campo]
      if (label) return { frase: `atualizou ${label}`, valor: null }
      return { frase: 'atualizou a tarefa', valor: null }
    }
    default:
      return { frase: 'atualizou a tarefa', valor: null }
  }
}
