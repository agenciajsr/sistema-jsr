import { z } from 'zod'

import { CANAIS_AQUISICAO } from '@/lib/financeiro/cac'

// Validação do lançamento de investimento em aquisição (quick-260720-pev).
// `canal` deve ser uma das chaves canônicas de CANAIS_AQUISICAO (fonte única em
// src/lib/financeiro/cac.ts) — evita divergência entre a lista da UI e o cálculo.
// `valor` 0 é válido (mês sem investimento no canal, mas registrado).
export const investimentoAquisicaoSchema = z.object({
  canal: z.enum(CANAIS_AQUISICAO as unknown as [string, ...string[]]),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida (use AAAA-MM)'),
  valor: z.coerce.number().nonnegative('Valor não pode ser negativo'),
  notas: z.string().optional(),
})

export type InvestimentoAquisicaoInput = z.infer<typeof investimentoAquisicaoSchema>
