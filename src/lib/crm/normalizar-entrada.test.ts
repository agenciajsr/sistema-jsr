import { describe, it, expect } from 'vitest'

import { normalizarLeadEntrada } from './normalizar-entrada'

describe('normalizarLeadEntrada', () => {
  it('JSON simples no nosso formato passa direto', () => {
    const r = normalizarLeadEntrada({
      fonte: 'landing_page',
      nome: 'Maria',
      telefone: '11999998888',
      email: 'maria@x.com',
    })
    expect(r.fonte).toBe('landing_page')
    expect(r.nome).toBe('Maria')
    expect(r.telefone).toBe('11999998888')
    expect(r.email).toBe('maria@x.com')
  })

  it('Elementor flat (form_fields[id]) mapeia por rótulo', () => {
    const r = normalizarLeadEntrada({
      'form_fields[Seu Nome]': 'João Silva',
      'form_fields[Seu WhatsApp]': '11988887777',
      'form_fields[Seu E-mail]': 'joao@clinica.com',
      form_id: 'abc123',
      page_url: 'https://trafegoparaestetica.com.br',
    })
    expect(r.nome).toBe('João Silva')
    expect(r.telefone).toBe('11988887777')
    expect(r.email).toBe('joao@clinica.com')
    // metadados (form_id/page_url) NÃO viram resposta
    expect(r.extra.respostas.some((p) => /form_id|page_url/.test(p.pergunta))).toBe(false)
  })

  it('Elementor Advanced Data (title+value) usa o título como pergunta', () => {
    const r = normalizarLeadEntrada({
      'fields[nome][title]': 'Seu Nome',
      'fields[nome][value]': 'Ana Paula',
      'fields[whats][title]': 'Seu WhatsApp',
      'fields[whats][value]': '11955554444',
      'fields[email][title]': 'Seu E-mail',
      'fields[email][value]': 'ana@estetica.com',
      'fields[nicho][title]': 'Qual o nicho da sua clínica?',
      'fields[nicho][value]': 'Harmonização facial',
      'fields[fat][title]': 'Quanto fatura por mês?',
      'fields[fat][value]': 'R$ 30 mil',
    })
    expect(r.nome).toBe('Ana Paula')
    expect(r.telefone).toBe('11955554444')
    expect(r.email).toBe('ana@estetica.com')
    // Respostas qualificadoras preservadas com o texto da pergunta
    const nicho = r.extra.respostas.find((p) => /nicho/i.test(p.pergunta))
    expect(nicho?.resposta).toBe('Harmonização facial')
    const fat = r.extra.respostas.find((p) => /fatura/i.test(p.pergunta))
    expect(fat?.resposta).toBe('R$ 30 mil')
  })

  it('email inválido (ex.: whats no campo errado) não vira email — nome ainda resolve', () => {
    const r = normalizarLeadEntrada({
      'form_fields[Seu Nome]': 'Carlos',
      'form_fields[Seu E-mail]': 'não-é-email',
    })
    expect(r.nome).toBe('Carlos')
    expect(r.email).toBeUndefined()
  })

  it('sem campo de nome: cai para telefone, depois email, depois "Lead sem nome"', () => {
    expect(normalizarLeadEntrada({ 'form_fields[Seu WhatsApp]': '1191234' }).nome).toBe('1191234')
    expect(normalizarLeadEntrada({ 'form_fields[Seu E-mail]': 'x@y.com' }).nome).toBe('x@y.com')
    expect(normalizarLeadEntrada({ page_url: 'https://x' }).nome).toBe('Lead sem nome')
  })

  it('fonte inválida ou ausente assume landing_page; fonte válida é respeitada', () => {
    expect(normalizarLeadEntrada({ 'form_fields[nome]': 'X' }).fonte).toBe('landing_page')
    expect(normalizarLeadEntrada({ fonte: 'meta_lead_ad', 'form_fields[nome]': 'X' }).fonte).toBe('meta_lead_ad')
    expect(normalizarLeadEntrada({ fonte: 'inexistente', 'form_fields[nome]': 'X' }).fonte).toBe('landing_page')
  })

  it('guarda o payload cru inteiro em extra.raw', () => {
    const r = normalizarLeadEntrada({ 'form_fields[Seu Nome]': 'Zé', page_url: 'https://x' })
    expect(r.extra.raw['form_fields[Seu Nome]']).toBe('Zé')
    expect(r.extra.raw['page_url']).toBe('https://x')
  })
})
