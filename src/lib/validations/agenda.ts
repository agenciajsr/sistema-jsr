import { z } from 'zod'

// Schema do formulário de evento da agenda. inicio/fim vêm do input
// datetime-local no formato 'YYYY-MM-DDTHH:mm' (hora local, interpretada
// como Brasília). Fica FORA do arquivo 'use server' porque um módulo
// 'use server' só pode exportar funções assíncronas (regra do next build).
export const eventoSchema = z
  .object({
    titulo: z.string().min(1, 'Título é obrigatório'),
    descricao: z.string().optional(),
    local: z.string().optional(),
    inicio: z.string().min(1, 'Início é obrigatório'),
    fim: z.string().min(1, 'Fim é obrigatório'),
  })
  .refine((v) => v.fim > v.inicio, {
    message: 'O fim deve ser depois do início.',
    path: ['fim'],
  })

export type EventoInput = z.infer<typeof eventoSchema>
