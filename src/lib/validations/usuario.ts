import { z } from 'zod'

export const usuarioSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senhaTemporaria: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'membro']),
})

export type UsuarioInput = z.infer<typeof usuarioSchema>
