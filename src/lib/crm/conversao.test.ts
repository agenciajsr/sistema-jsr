import { describe, expect, it } from 'vitest'

import { clienteExistenteDe, dadosClienteDe } from './conversao'

// Conversão Ganho → Cliente (Fase 3 do funil): lógica PURA de decisão.
// O CRM é LEAD-FIRST — a maioria das oportunidades tem só contato, sem empresa.

const contatoBase = {
  nome: 'Maria Silva',
  telefone: '(62) 99999-0000',
  email: 'maria@exemplo.com',
  clienteId: null as string | null,
}

const empresaBase = {
  nome: 'Padaria Central',
  clienteId: null as string | null,
}

describe('clienteExistenteDe', () => {
  it('retorna null quando nem contato nem empresa viraram cliente', () => {
    expect(clienteExistenteDe({ contato: contatoBase, empresa: empresaBase })).toBeNull()
  })

  it('retorna null quando não há contato nem empresa', () => {
    expect(clienteExistenteDe({ contato: null, empresa: null })).toBeNull()
  })

  it('retorna o clienteId do contato quando o lead já virou cliente', () => {
    expect(
      clienteExistenteDe({ contato: { ...contatoBase, clienteId: 'cli-1' }, empresa: empresaBase })
    ).toBe('cli-1')
  })

  it('retorna o clienteId da empresa quando só a empresa já é cliente', () => {
    expect(
      clienteExistenteDe({ contato: contatoBase, empresa: { ...empresaBase, clienteId: 'cli-2' } })
    ).toBe('cli-2')
  })

  it('prioriza o clienteId do contato sobre o da empresa', () => {
    expect(
      clienteExistenteDe({
        contato: { ...contatoBase, clienteId: 'cli-contato' },
        empresa: { ...empresaBase, clienteId: 'cli-empresa' },
      })
    ).toBe('cli-contato')
  })

  it('funciona lead-first: só contato, sem empresa', () => {
    expect(clienteExistenteDe({ contato: { ...contatoBase, clienteId: 'cli-3' } })).toBe('cli-3')
    expect(clienteExistenteDe({ contato: contatoBase })).toBeNull()
  })
})

describe('dadosClienteDe', () => {
  it('lead-first: monta o cliente com os dados do contato quando não há empresa', () => {
    expect(dadosClienteDe({ contato: contatoBase })).toEqual({
      nome: 'Maria Silva',
      status: 'aguardando_inicio',
      nicho: 'negocio_local',
      contatoNome: 'Maria Silva',
      contatoTelefone: '(62) 99999-0000',
      contatoEmail: 'maria@exemplo.com',
    })
  })

  it('contato + empresa: nome do cliente vem da EMPRESA, contato preenche os campos de contato', () => {
    expect(dadosClienteDe({ contato: contatoBase, empresa: empresaBase })).toEqual({
      nome: 'Padaria Central',
      status: 'aguardando_inicio',
      nicho: 'negocio_local',
      contatoNome: 'Maria Silva',
      contatoTelefone: '(62) 99999-0000',
      contatoEmail: 'maria@exemplo.com',
    })
  })

  it('só empresa, sem contato: campos de contato ficam null', () => {
    expect(dadosClienteDe({ empresa: empresaBase })).toEqual({
      nome: 'Padaria Central',
      status: 'aguardando_inicio',
      nicho: 'negocio_local',
      contatoNome: null,
      contatoTelefone: null,
      contatoEmail: null,
    })
  })

  it('telefone/email ausentes no contato viram null (lead mínimo do webhook)', () => {
    expect(
      dadosClienteDe({ contato: { ...contatoBase, telefone: null, email: null } })
    ).toMatchObject({ contatoTelefone: null, contatoEmail: null })
  })

  it('sem contato nem empresa: conversão inválida → null', () => {
    expect(dadosClienteDe({})).toBeNull()
    expect(dadosClienteDe({ contato: null, empresa: null })).toBeNull()
  })
})
