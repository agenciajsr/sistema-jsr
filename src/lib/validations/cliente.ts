import { z } from 'zod'

import { somenteDigitos, validarCNPJ, validarCPF } from './documento'

export const SERVICOS_DISPONIVEIS = [
  'meta_ads', 'google_ads', 'site', 'criativos', 'social_media', 'consultoria',
  'gestao_trafego', 'landing_page', 'crm_estruturacao'
] as const

export const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  nicho: z.enum(['ecommerce', 'negocio_local', 'infoproduto'], {
    message: 'Selecione um nicho válido',
  }),
  // Ramo específico do cliente (ex: "Clínica de Estética") e o que ele vende
  // (ex: "Emagrecimento") — texto livre, um nível abaixo do nicho.
  segmento: z.string().optional(),
  principalServico: z.string().optional(),
  // Tags livres separadas por vírgula no form (ex: "Estética, Laser, Alto
  // potencial") — convertidas para array em clienteParaDb (coluna jsonb tags).
  tagsTexto: z.string().optional(),
  status: z.enum(['ativo', 'pausado', 'encerrado', 'aguardando_inicio', 'em_aviso']).default('ativo'),
  // Perfil interno da agência (perfil mãe): fica fora das métricas de negócio.
  interno: z.boolean().default(false),
  // Obrigatório quando status = encerrado (validado no superRefine abaixo) —
  // fica documentado NO cliente por que ele saiu.
  motivoEncerramento: z.string().optional(),
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
  servicosContratados: z.array(z.enum(['meta_ads', 'google_ads', 'site', 'criativos', 'social_media', 'consultoria', 'gestao_trafego', 'landing_page', 'crm_estruturacao'])).default([]),
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
  // Pastas do Drive nomeadas: [{nome, url}]. Cada linha exige nome + URL válida;
  // remova linhas vazias antes de salvar (o form mostra o erro por linha).
  pastas: z
    .array(
      z.object({
        nome: z.string().min(1, 'Informe o nome da pasta'),
        url: z.string().url('Link inválido'),
      }),
    )
    .default([]),
}).superRefine((v, ctx) => {
  if (v.status === 'encerrado' && !v.motivoEncerramento?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['motivoEncerramento'],
      message: 'Informe o motivo do encerramento',
    })
  }
  // Documento alimenta contrato e Asaas: se preenchido, os dígitos verificadores
  // têm que fechar (CPF p/ pessoa física, CNPJ p/ jurídica).
  const digitos = somenteDigitos(v.documento ?? '')
  if (digitos.length > 0) {
    if (v.tipoPessoa === 'fisica' && !validarCPF(digitos)) {
      ctx.addIssue({
        code: 'custom',
        path: ['documento'],
        message: 'CPF inválido — confira os números digitados',
      })
    }
    if (v.tipoPessoa === 'juridica' && !validarCNPJ(digitos)) {
      ctx.addIssue({
        code: 'custom',
        path: ['documento'],
        message: 'CNPJ inválido — confira os números digitados',
      })
    }
  }
})

export type ClienteInput = z.infer<typeof clienteSchema>
