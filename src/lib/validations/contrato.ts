import { z } from 'zod'

const dataRegex = /^\d{4}-\d{2}-\d{2}$/

export const contratoSchema = z
  .object({
    dataInicio: z.string().regex(dataRegex, 'Data de início inválida'),
    dataVencimento: z.string().regex(dataRegex, 'Data de vencimento inválida'),
    valorMensal: z.coerce.number().positive('Valor mensal deve ser maior que zero'),
  })
  .refine((data) => data.dataVencimento > data.dataInicio, {
    message: 'Data de vencimento deve ser posterior à data de início',
    path: ['dataVencimento'],
  })

export type ContratoInput = z.infer<typeof contratoSchema>
