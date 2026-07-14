import { z } from 'zod'

// Mesma filosofia de validations/transacao.ts: os Selects do form mandam ''
// quando "Nenhum" está escolhido — normalizamos para undefined aqui.

const opcionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(''))
  .transform((v) => v || undefined)

export const RECORRENCIAS = [
  'nenhuma',
  'diaria',
  'semanal',
  'mensal',
  'anual',
  'dia_sim_dia_nao',
  'dias_uteis',
  'personalizada',
] as const

export const STATUS_TAREFA = ['a_fazer', 'em_andamento', 'concluida', 'nao_realizada'] as const
export const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'] as const

/** Data opcional 'YYYY-MM-DD'; '' (Select/Input vazio) vira undefined. */
const opcionalData = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || undefined)

export const tarefaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da tarefa'),
  notas: z.string().optional(),
  descricao: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida'),
  dataInicio: opcionalData,
  clienteId: opcionalUuid,
  responsavelId: opcionalUuid,
  prioridade: z.enum(PRIORIDADES).default('media'),
  // O "+ Adicionar tarefa" de cada coluna cria já no status daquela coluna.
  status: z.enum(STATUS_TAREFA).default('a_fazer'),
  etiquetas: z.array(z.string().trim().min(1)).max(20).optional(),
  tempoEstimado: z.string().trim().max(20).optional(),
  recorrencia: z.enum(RECORRENCIAS).default('nenhuma'),
  // 0=domingo … 6=sábado. Só faz sentido em 'personalizada'.
  recorrenciaDias: z.array(z.number().int().min(0).max(6)).optional(),
  // Itens do checklist informados na CRIAÇÃO (na edição cada item tem sua action).
  // D-08: cada item carrega o grupo a que pertence.
  checklist: z
    .array(z.object({ texto: z.string().trim().min(1), grupo: z.string().trim().default('Checklist') }))
    .optional(),
})

export type TarefaInput = z.input<typeof tarefaSchema>

export const atualizarTarefaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da tarefa').optional(),
  notas: z.string().optional(),
  descricao: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida').optional(),
  dataInicio: opcionalData,
  clienteId: opcionalUuid,
  responsavelId: opcionalUuid,
  prioridade: z.enum(PRIORIDADES).optional(),
  status: z.enum(STATUS_TAREFA).optional(),
  etiquetas: z.array(z.string().trim().min(1)).max(20).optional(),
  tempoEstimado: z.string().trim().max(20).optional(),
})

export type AtualizarTarefaInput = z.input<typeof atualizarTarefaSchema>

export const recorrenciaSchema = z.object({
  recorrencia: z.enum(RECORRENCIAS),
  recorrenciaDias: z.array(z.number().int().min(0).max(6)).optional(),
  ativa: z.boolean().optional(),
})

export type RecorrenciaInput = z.input<typeof recorrenciaSchema>
