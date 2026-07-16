import { z } from 'zod'

import { SERVICOS_KEYS } from '@/lib/crm/servicos'

const dataRegex = /^\d{4}-\d{2}-\d{2}$/

const contratoBase = z.object({
  dataInicio: z.string().regex(dataRegex, 'Data de início inválida'),
  dataVencimento: z.string().regex(dataRegex, 'Data de vencimento inválida'),
  valorMensal: z.coerce.number().positive('Valor mensal deve ser maior que zero'),
})

const vencimentoAposInicio = {
  message: 'Data de vencimento deve ser posterior à data de início',
  path: ['dataVencimento'],
}

export const contratoSchema = contratoBase.refine(
  (data) => data.dataVencimento > data.dataInicio,
  vencimentoAposInicio
)

export type ContratoInput = z.infer<typeof contratoSchema>

// Edição completa (Fase 4 Parte 2): além das datas/valor, permite ajustar
// serviço, duração e tipo de documento (todos opcionais — colunas nullable).
export const contratoEdicaoSchema = contratoBase
  .extend({
    servico: z.enum(SERVICOS_KEYS).nullable().optional(),
    duracaoMeses: z.coerce.number().int().min(1).max(36).nullable().optional(),
    tipoDocumento: z.string().trim().max(40).nullable().optional(),
  })
  .refine((data) => data.dataVencimento > data.dataInicio, vencimentoAposInicio)

export type ContratoEdicaoInput = z.infer<typeof contratoEdicaoSchema>
