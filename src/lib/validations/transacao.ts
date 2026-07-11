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
})

export type TransacaoInput = z.infer<typeof transacaoSchema>
