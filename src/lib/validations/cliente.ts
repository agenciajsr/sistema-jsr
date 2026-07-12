import { z } from 'zod'

export const SERVICOS_DISPONIVEIS = [
  'meta_ads', 'google_ads', 'site', 'criativos', 'social_media', 'consultoria'
] as const

export const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  nicho: z.enum(['ecommerce', 'negocio_local', 'infoproduto'], {
    message: 'Selecione um nicho válido',
  }),
  status: z.enum(['ativo', 'pausado', 'encerrado']).default('ativo'),
  // Contato
  contatoNome: z.string().optional(),
  contatoTelefone: z.string().optional(),
  contatoEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  // Dados fiscais
  tipoPessoa: z.enum(['fisica', 'juridica']).default('juridica'),
  documento: z.string().optional(),
  razaoSocial: z.string().optional(),
  nomeFantasia: z.string().optional(),
  // Endereço
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  // Online
  instagram: z.string().optional(),
  siteUrl: z.string().optional(),
  // Pagamento
  formaPagamento: z.enum(['pix', 'boleto', 'cartao', 'transferencia']).optional(),
  diaPagamento: z.coerce.number().int().min(1).max(31).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  // Serviços
  servicosContratados: z.array(z.enum(['meta_ads', 'google_ads', 'site', 'criativos', 'social_media', 'consultoria'])).default([]),
  // Operação
  gestorId: z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  verbaMensal: z.coerce.number().min(0).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  ticketMedio: z.coerce.number().min(0).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  agendamentoPosts: z.boolean().default(false),
  frequenciaPosts: z.string().optional(),
  // Observações
  notas: z.string().optional(),
  origemCliente: z.string().optional(),
  objetivoPrincipal: z.string().optional(),
  linkDrive: z.string().url('Link inválido').optional().or(z.literal('')),
})

export type ClienteInput = z.infer<typeof clienteSchema>
