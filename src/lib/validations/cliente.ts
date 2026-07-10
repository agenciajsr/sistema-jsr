import { z } from 'zod'

export const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  nicho: z.enum(['ecommerce', 'negocio_local', 'infoproduto'], {
    message: 'Selecione um nicho válido',
  }),
  status: z.enum(['ativo', 'pausado', 'encerrado']).default('ativo'),
  contatoNome: z.string().optional(),
  contatoTelefone: z.string().optional(),
  contatoEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  notas: z.string().optional(),
})

export type ClienteInput = z.infer<typeof clienteSchema>
