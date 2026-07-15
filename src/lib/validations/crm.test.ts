import { describe, it, expect } from 'vitest'

import { leadSchema } from '@/lib/validations/crm'

// leadSchema e a porta de entrada do fluxo LEAD-FIRST (D-01/D-02): o form pede
// os dados do LEAD, nunca um titulo livre. Sem email NEM telefone nao ha como
// deduplicar o contato — por isso o refine exige ao menos um dos dois.

const base = {
  nome: 'Joao Silva',
  telefone: '(31) 99876-5432',
  servico: 'trafego_pago',
  etapaId: '11111111-1111-4111-8111-111111111111',
}

describe('leadSchema', () => {
  it('rejeita nome vazio', () => {
    const r = leadSchema.safeParse({ ...base, nome: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita quando nao ha email nem telefone', () => {
    const r = leadSchema.safeParse({ ...base, telefone: '', email: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toBe('Informe email ou telefone do lead.')
    }
  })

  it('aceita com email e sem telefone', () => {
    const r = leadSchema.safeParse({ ...base, telefone: '', email: 'joao@exemplo.com' })
    expect(r.success).toBe(true)
  })

  it('aceita com telefone e sem email', () => {
    const r = leadSchema.safeParse({ ...base, email: '' })
    expect(r.success).toBe(true)
  })

  it('rejeita servico fora da lista fechada da JSR', () => {
    const r = leadSchema.safeParse({ ...base, servico: 'consultoria_seo' })
    expect(r.success).toBe(false)
  })

  it('aceita os 4 servicos validos', () => {
    for (const servico of ['trafego_pago', 'landing_page', 'crm_automacao', 'estrategia']) {
      const r = leadSchema.safeParse({ ...base, servico })
      expect(r.success).toBe(true)
    }
  })

  it('aplica os defaults de tipoReceita e origem quando ausentes', () => {
    const r = leadSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.tipoReceita).toBe('mensalidade')
      expect(r.data.origem).toBe('manual')
    }
  })

  // Campos do modal "Criar novo Lead" (imagens 07-11): todos OPCIONAIS — o
  // lead pode ser cadastrado só com nome + telefone, como antes.
  it('aceita os campos novos todos vazios (continuam opcionais)', () => {
    const r = leadSchema.safeParse({
      ...base,
      site: '',
      dataNascimento: '',
      pais: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      notas: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.site).toBeUndefined()
      expect(r.data.notas).toBeUndefined()
    }
  })

  it('mantem o refine "email OU telefone" mesmo com os campos novos preenchidos', () => {
    const r = leadSchema.safeParse({
      ...base,
      telefone: '',
      email: '',
      site: 'www.meulead.com.br',
      cidade: 'Sao Paulo',
    })
    expect(r.success).toBe(false)
  })

  it('tagIds: aceita array de uuid e usa [] como default', () => {
    const semTags = leadSchema.safeParse(base)
    expect(semTags.success).toBe(true)
    if (semTags.success) expect(semTags.data.tagIds).toEqual([])

    const comTags = leadSchema.safeParse({
      ...base,
      tagIds: ['22222222-2222-4222-8222-222222222222'],
    })
    expect(comTags.success).toBe(true)
    if (comTags.success) expect(comTags.data.tagIds).toHaveLength(1)

    const invalido = leadSchema.safeParse({ ...base, tagIds: ['nao-e-uuid'] })
    expect(invalido.success).toBe(false)
  })

  it('dataNascimento: rejeita 2000-13-99 e aceita 1990-05-20', () => {
    const invalida = leadSchema.safeParse({ ...base, dataNascimento: '2000-13-99' })
    expect(invalida.success).toBe(false)

    const valida = leadSchema.safeParse({ ...base, dataNascimento: '1990-05-20' })
    expect(valida.success).toBe(true)
    if (valida.success) expect(valida.data.dataNascimento).toBe('1990-05-20')
  })
})
