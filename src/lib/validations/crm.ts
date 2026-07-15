import { z } from 'zod'

// Mesma filosofia de validations/tarefa.ts: os Selects/Inputs do form mandam ''
// quando "Nenhum" está escolhido — normalizamos para undefined aqui.

const opcionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(''))
  .transform((v) => v || undefined)

/** Data opcional 'YYYY-MM-DD'; '' (Select/Input vazio) vira undefined. */
const opcionalData = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || undefined)

/** Email opcional: '' vira undefined; presente precisa ser válido. */
const opcionalEmail = z
  .string()
  .email('Email invalido')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || undefined)

/** Texto opcional: '' vira undefined. */
const opcionalTexto = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined)

export const TIPOS_RECEITA = ['mensalidade', 'projeto'] as const
export const TIPOS_TAREFA_CRM = ['ligacao', 'whatsapp', 'email', 'reuniao', 'followup', 'outro'] as const
export const FONTES_LEAD = ['landing_page', 'meta_lead_ad', 'whatsapp', 'manual', 'outro'] as const

export const empresaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da empresa'),
  cnpj: opcionalTexto,
  segmento: opcionalTexto,
  site: opcionalTexto,
  instagram: opcionalTexto,
  telefone: opcionalTexto,
  cidade: opcionalTexto,
  estado: opcionalTexto,
  notas: opcionalTexto,
  donoId: opcionalUuid,
})
export type EmpresaInput = z.input<typeof empresaSchema>

export const contatoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do contato'),
  email: opcionalEmail,
  telefone: opcionalTexto,
  cargo: opcionalTexto,
  empresaId: opcionalUuid,
  origem: z.string().trim().min(1).default('manual'),
  donoId: opcionalUuid,
})
export type ContatoInput = z.input<typeof contatoSchema>

export const pipelineSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do pipeline'),
})
export type PipelineInput = z.input<typeof pipelineSchema>

export const etapaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da etapa'),
  cor: opcionalTexto,
  probabilidade: z.coerce
    .number()
    .int('Probabilidade invalida')
    .min(0, 'Probabilidade minima e 0')
    .max(100, 'Probabilidade maxima e 100')
    .optional(),
})
export type EtapaInput = z.input<typeof etapaSchema>

export const oportunidadeSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da oportunidade'),
  valor: z.coerce.number().nonnegative('O valor nao pode ser negativo').optional(),
  tipoReceita: z.enum(TIPOS_RECEITA).default('mensalidade'),
  etapaId: z.string().uuid('Escolha a etapa'),
  empresaId: opcionalUuid,
  contatoId: opcionalUuid,
  // Nomes livres vindos do dialog de criação: se vierem, a action cria
  // contato/empresa mínimos antes da oportunidade.
  contatoNome: opcionalTexto,
  empresaNome: opcionalTexto,
  origem: opcionalTexto,
  servicosInteresse: z.array(z.string().trim().min(1)).optional(),
  dataPrevistaFechamento: opcionalData,
  donoId: opcionalUuid,
})
export type OportunidadeInput = z.input<typeof oportunidadeSchema>

export const atualizarOportunidadeSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da oportunidade').optional(),
  valor: z.coerce.number().nonnegative('O valor nao pode ser negativo').optional(),
  tipoReceita: z.enum(TIPOS_RECEITA).optional(),
  empresaId: opcionalUuid,
  contatoId: opcionalUuid,
  origem: opcionalTexto,
  servicosInteresse: z.array(z.string().trim().min(1)).optional(),
  dataPrevistaFechamento: opcionalData,
  donoId: opcionalUuid,
})
export type AtualizarOportunidadeInput = z.input<typeof atualizarOportunidadeSchema>

export const crmTarefaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o titulo da tarefa'),
  tipo: z.enum(TIPOS_TAREFA_CRM).default('followup'),
  notas: opcionalTexto,
  // ISO datetime (com ou sem offset) — o vencimento comercial tem hora.
  dataVencimento: z
    .string()
    .min(1, 'Informe a data de vencimento')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data de vencimento invalida'),
  oportunidadeId: opcionalUuid,
  contatoId: opcionalUuid,
  donoId: opcionalUuid,
})
export type CrmTarefaInput = z.input<typeof crmTarefaSchema>

// Payload da API pública POST /api/crm/leads (validado ANTES de tocar o banco).
export const leadEntradaSchema = z
  .object({
    fonte: z.enum(FONTES_LEAD),
    nome: z.string().trim().min(1, 'Informe o nome do lead'),
    email: opcionalEmail,
    telefone: opcionalTexto,
    empresa: opcionalTexto,
    mensagem: opcionalTexto,
    servicosInteresse: z.array(z.string().trim().min(1)).optional(),
    valorEstimado: z.coerce.number().nonnegative().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.email || v.telefone), {
    message: 'Informe email ou telefone do lead.',
  })
export type LeadEntrada = z.output<typeof leadEntradaSchema>
export type LeadEntradaInput = z.input<typeof leadEntradaSchema>
