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

export const tarefaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da tarefa'),
  notas: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida'),
  clienteId: opcionalUuid,
  responsavelId: opcionalUuid,
  prioridade: z.enum(PRIORIDADES).default('media'),
  recorrencia: z.enum(RECORRENCIAS).default('nenhuma'),
  // 0=domingo … 6=sábado. Só faz sentido em 'personalizada'.
  recorrenciaDias: z.array(z.number().int().min(0).max(6)).optional(),
  // Itens do checklist informados na CRIAÇÃO (na edição cada item tem sua action).
  checklist: z.array(z.string().trim().min(1)).optional(),
})

export type TarefaInput = z.input<typeof tarefaSchema>

export const atualizarTarefaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da tarefa').optional(),
  notas: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida').optional(),
  clienteId: opcionalUuid,
  responsavelId: opcionalUuid,
  prioridade: z.enum(PRIORIDADES).optional(),
  status: z.enum(STATUS_TAREFA).optional(),
})

export type AtualizarTarefaInput = z.input<typeof atualizarTarefaSchema>

export const recorrenciaSchema = z.object({
  recorrencia: z.enum(RECORRENCIAS),
  recorrenciaDias: z.array(z.number().int().min(0).max(6)).optional(),
  ativa: z.boolean().optional(),
})

export type RecorrenciaInput = z.input<typeof recorrenciaSchema>
