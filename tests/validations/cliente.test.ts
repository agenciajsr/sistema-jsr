import { describe, it, expect } from 'vitest'
import { clienteSchema } from '@/lib/validations/cliente'

describe('clienteSchema', () => {
  it('aceita o mínimo válido (nome + nicho, status default ativo, contato/notas ausentes)', () => {
    const result = clienteSchema.safeParse({ nome: 'Loja X', nicho: 'ecommerce' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('ativo')
    }
  })

  it('aceita um cliente completo com todos os campos preenchidos', () => {
    const result = clienteSchema.safeParse({
      nome: 'Loja X',
      nicho: 'negocio_local',
      status: 'pausado',
      contatoNome: 'João',
      contatoTelefone: '11999999999',
      contatoEmail: 'joao@x.com',
      notas: 'Cliente antigo',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    const result = clienteSchema.safeParse({ nome: '', nicho: 'ecommerce' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('nome'))).toBe(true)
    }
  })

  it('rejeita nicho fora do enum', () => {
    const result = clienteSchema.safeParse({ nome: 'Loja X', nicho: 'outro' })
    expect(result.success).toBe(false)
  })

  it('rejeita contatoEmail com formato inválido quando fornecido', () => {
    const result = clienteSchema.safeParse({
      nome: 'Loja X',
      nicho: 'ecommerce',
      contatoEmail: 'nao-e-email',
    })
    expect(result.success).toBe(false)
  })

  it('aceita contatoEmail ausente (campo opcional)', () => {
    const result = clienteSchema.safeParse({ nome: 'Loja X', nicho: 'ecommerce' })
    expect(result.success).toBe(true)
  })
})
