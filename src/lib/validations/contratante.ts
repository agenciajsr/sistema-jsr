// Schema dos dados do CONTRATANTE (página pública /contrato/[token]) — módulo
// puro compartilhado entre o formulário (client) e a action pública (server):
// NUNCA confiar só na validação do client. Mensagens em pt-BR.

import { z } from 'zod'

import { validarCpf, validarCnpj } from './documentos'

const texto = (msg: string) => z.string().trim().min(1, msg)

const cpfSchema = z
  .string()
  .trim()
  .min(1, 'Informe o CPF.')
  .refine(validarCpf, 'CPF inválido — confira os dígitos.')

const emailSchema = z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.')

// Pessoa Jurídica: dados da empresa + representante legal.
export const contratantePjSchema = z.object({
  tipo: z.literal('pj'),
  razaoSocial: texto('Informe a razão social.'),
  cnpj: z
    .string()
    .trim()
    .min(1, 'Informe o CNPJ.')
    .refine(validarCnpj, 'CNPJ inválido — confira os dígitos.'),
  enderecoSede: texto('Informe o endereço da sede.'),
  telefone: texto('Informe o telefone.'),
  nomeRepresentante: texto('Informe o nome do representante.'),
  nacionalidade: texto('Informe a nacionalidade.'),
  estadoCivil: texto('Informe o estado civil.'),
  profissao: texto('Informe a profissão.'),
  cpf: cpfSchema,
  enderecoRepresentante: texto('Informe o endereço do representante.'),
  email: emailSchema,
})

// Pessoa Física.
export const contratantePfSchema = z.object({
  tipo: z.literal('pf'),
  nomeCompleto: texto('Informe o nome completo.'),
  cpf: cpfSchema,
  nacionalidade: texto('Informe a nacionalidade.'),
  estadoCivil: texto('Informe o estado civil.'),
  profissao: texto('Informe a profissão.'),
  endereco: texto('Informe o endereço.'),
  telefone: texto('Informe o telefone.'),
  email: emailSchema,
})

export const contratanteSchema = z.discriminatedUnion('tipo', [
  contratantePjSchema,
  contratantePfSchema,
])

export type ContratanteInput = z.infer<typeof contratanteSchema>
