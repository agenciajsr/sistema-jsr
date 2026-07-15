import { z } from 'zod'

import { SERVICOS_KEYS } from '@/lib/crm/servicos'

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

/**
 * Data opcional 'YYYY-MM-DD' que precisa ser um dia REAL do calendário
 * ('2000-13-99' bate no regex mas não existe). Usada na Data de Nascimento do
 * modal "Criar novo Lead".
 */
const opcionalDataReal = opcionalData.refine(
  (v) => {
    if (v === undefined) return true
    const [ano, mes, dia] = v.split('-').map(Number)
    const d = new Date(Date.UTC(ano, mes - 1, dia))
    return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
  },
  { message: 'Data invalida' }
)

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

// Origens do LEAD no cadastro manual (/crm → Novo Lead). São EXATAMENTE as 6
// chaves de ORIGEM_META (src/lib/crm/origem.ts): o badge de origem do card lê
// esse mesmo valor, então divergir aqui faria todo card cair no fallback
// 'outro'. Difere de FONTES_LEAD (API pública), que não tem 'indicacao'.
export const ORIGENS_LEAD = [
  'manual',
  'whatsapp',
  'landing_page',
  'meta_lead_ad',
  'indicacao',
  'outro',
] as const

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

// --- Fluxo LEAD-FIRST (D-01/D-02) ---
// A porta de entrada do CRM é o LEAD, não um "título" livre de negócio: o lead
// chega (form Meta, WhatsApp, indicação, prospecção) com nome/contato/origem, e
// a MESMA pessoa pode ter N negócios (perder Tráfego e ganhar Landing Page).
// O `titulo` de crm_oportunidades (NOT NULL) é derivado na action a partir de
// serviço + nome — nunca digitado. oportunidadeSchema continua existindo para
// não quebrar a API pública/ingest.

export const leadSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do lead'),
    empresaNome: opcionalTexto,
    email: opcionalEmail,
    telefone: opcionalTexto,
    documento: opcionalTexto,
    origem: z.enum(ORIGENS_LEAD).default('manual'),
    // --- Campos do modal "Criar novo Lead" (imagens 07-11), TODOS opcionais ---
    // Aba Contato
    site: opcionalTexto,
    // Aba Dados Pessoais
    dataNascimento: opcionalDataReal,
    // Aba Endereço (default 'Brasil' fica no FORM, não aqui: schema neutro)
    pais: opcionalTexto,
    cep: opcionalTexto,
    endereco: opcionalTexto,
    numero: opcionalTexto,
    complemento: opcionalTexto,
    bairro: opcionalTexto,
    cidade: opcionalTexto,
    estado: opcionalTexto,
    // Aba Anotações
    notas: opcionalTexto,
    // Tags (crm_tags) escolhidas/criadas no seletor do topo do modal.
    tagIds: z.array(z.string().uuid()).default([]),
    // Lista FECHADA: a JSR vende 4 coisas (ver src/lib/crm/servicos.ts).
    servico: z.enum(SERVICOS_KEYS),
    valor: z.coerce.number().nonnegative('O valor nao pode ser negativo').optional(),
    tipoReceita: z.enum(TIPOS_RECEITA).default('mensalidade'),
    etapaId: z.string().uuid('Escolha a etapa'),
    donoId: opcionalUuid,
  })
  // Sem email NEM telefone não há identidade para deduplicar o contato (D-02) —
  // o lead entraria como cadastro novo toda vez.
  .refine((v) => Boolean(v.email || v.telefone), {
    message: 'Informe email ou telefone do lead.',
  })
export type LeadInput = z.input<typeof leadSchema>
export type LeadValidado = z.output<typeof leadSchema>

// Edição do perfil do lead na ficha (aba Perfil). Só o nome é obrigatório: o
// resto vai sendo preenchido conforme a agência descobre.
export const leadPerfilSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do lead'),
  email: opcionalEmail,
  telefone: opcionalTexto,
  documento: opcionalTexto,
  site: opcionalTexto,
  cargo: opcionalTexto,
  dataNascimento: opcionalData,
  cep: opcionalTexto,
  endereco: opcionalTexto,
  // Endereço completo (aba Endereço da ficha de dois painéis).
  pais: opcionalTexto,
  numero: opcionalTexto,
  complemento: opcionalTexto,
  bairro: opcionalTexto,
  cidade: opcionalTexto,
  estado: opcionalTexto,
  notas: opcionalTexto,
  empresaId: opcionalUuid,
  origem: z.enum(ORIGENS_LEAD).optional(),
})
export type LeadPerfilInput = z.input<typeof leadPerfilSchema>

// Tag do CRM (badges do modal "Criar novo Lead"). `cor` precisa ser uma chave
// de CORES_TAG — a action valida contra a paleta (src/lib/crm/tags.ts).
export const tagSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da tag'),
  cor: z.string().trim().min(1, 'Escolha a cor da tag'),
})
export type TagInput = z.input<typeof tagSchema>

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

// --- Atividade AGENDADA (modal "Criar atividade" da ficha do lead) ---
// Persiste em crm_tarefas com data_inicio/data_fim/prioridade; dataVencimento
// da tarefa é preenchida com dataFim na action (heurística "sem contato +7d").
export const PRIORIDADES_ATIVIDADE = ['baixa', 'media', 'alta'] as const

/** ISO datetime obrigatório (com hora). */
const dataHoraObrigatoria = (mensagem: string) =>
  z
    .string()
    .min(1, mensagem)
    .refine((v) => !Number.isNaN(Date.parse(v)), mensagem)

export const atividadeSchema = z
  .object({
    titulo: z.string().trim().min(1, 'Informe um titulo para a atividade'),
    contatoId: z.string().uuid('Lead invalido'),
    oportunidadeId: opcionalUuid,
    donoId: opcionalUuid,
    dataInicio: dataHoraObrigatoria('Informe a data/hora de inicio'),
    dataFim: dataHoraObrigatoria('Informe a data/hora de fim'),
    tipo: z.enum(TIPOS_TAREFA_CRM).default('followup'),
    prioridade: z
      .enum(PRIORIDADES_ATIVIDADE)
      .optional()
      .or(z.literal(''))
      .transform((v) => v || undefined),
    descricao: opcionalTexto,
  })
  .refine((v) => Date.parse(v.dataFim) > Date.parse(v.dataInicio), {
    message: 'O fim da atividade precisa ser depois do inicio.',
  })
export type AtividadeInput = z.input<typeof atividadeSchema>

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
