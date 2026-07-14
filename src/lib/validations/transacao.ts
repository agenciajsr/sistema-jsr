import { z } from 'zod'

export const transacaoSchema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  categoria: z.enum(['mensalidade', 'projeto', 'outro', 'ferramenta', 'ads_agencia', 'salario']),
  clienteId: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
  descricao: z.string().min(1, 'Descricao e obrigatoria'),
  valor: z.coerce.number().positive('Valor deve ser maior que zero'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida'),
  status: z.enum(['pago', 'pendente', 'vencido']).default('pendente'),
  diaVencto: z.coerce.number().int().min(1).max(31).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notas: z.string().optional(),
  centroCusto: z.enum(['operacao', 'midia', 'infraestrutura']).optional().or(z.literal('')).transform(v => v || undefined),
  recorrencia: z.enum(['semanal', 'mensal', 'trimestral', 'avulsa']).default('avulsa'),
  formaPagamento: z.enum(['pix', 'boleto', 'cartao', 'transferencia']).optional().or(z.literal('')).transform(v => v || undefined),
  responsavelId: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
  comprovanteUrl: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
})

export type TransacaoInput = z.infer<typeof transacaoSchema>
