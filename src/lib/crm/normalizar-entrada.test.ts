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

  // Payload REAL do Elementor (Advanced Data ON) capturado do form da landing.
  const elementorReal: Record<string, string> = {
    'form[id]': '55f8b75',
    'form[name]': 'Dados de Contato',
    'meta[date][title]': 'Date',
    'meta[date][value]': '16/07/2026',
    'meta[page_url][title]': 'Page URL',
    'meta[page_url][value]': 'https://trafegoparaestetica.com.br/',
    'fields[name][title]': 'Seu Nome',
    'fields[name][value]': 'Jack teste',
    'fields[name][type]': 'text',
    'fields[field_38c2e8e][title]': 'Seu WhatsApp',
    'fields[field_38c2e8e][value]': '71993636734',
    'fields[field_38c2e8e][type]': 'tel',
    'fields[field_0a4ec08][title]': 'Seu E-mail',
    'fields[field_0a4ec08][value]': 'jackteste@gmail.com',
    'fields[field_0a4ec08][type]': 'email',
    'fields[field_161ea59][title]': '',
    'fields[field_161ea59][value]': '',
    'fields[field_161ea59][type]': 'step',
    'fields[field_c5efe2d][title]': 'Qual o faturamento mensal atual da sua clínica?',
    'fields[field_c5efe2d][value]': 'Até R$5.000/mês',
    'fields[field_c5efe2d][type]': 'select',
    'fields[field_ca5d16e][title]': 'Qual o seu Instagram?',
    'fields[field_ca5d16e][value]': '@jackteste',
    'fields[field_ca5d16e][type]': 'text',
    'fields[utm_source][title]': 'utm_source',
    'fields[utm_source][value]': '',
    'fields[utm_source][type]': 'hidden',
    'fields[utm_campaign][title]': 'utm_campaign',
    'fields[utm_campaign][value]': '',
    'fields[utm_campaign][type]': 'hidden',
  }

  it('Elementor real: mapeia nome/whatsapp/email corretamente (não pega form[name])', () => {
    const r = normalizarLeadEntrada(elementorReal)
    expect(r.nome).toBe('Jack teste') // NÃO "Dados de Contato"
    expect(r.telefone).toBe('71993636734')
    expect(r.email).toBe('jackteste@gmail.com')
  })

  it('Elementor real: respostas contêm só as qualificadoras (sem lixo/estrutura)', () => {
    const r = normalizarLeadEntrada(elementorReal)
    const perguntas = r.extra.respostas.map((p) => p.pergunta)
    // qualificadoras presentes
    expect(perguntas).toContain('Qual o faturamento mensal atual da sua clínica?')
    expect(perguntas).toContain('Qual o seu Instagram?')
    // básicos NÃO se repetem nas respostas
    expect(perguntas).not.toContain('Seu Nome')
    expect(perguntas).not.toContain('Seu WhatsApp')
    expect(perguntas).not.toContain('Seu E-mail')
    // nada de estrutura/metadados/step/utm
    expect(perguntas.some((p) => /form\[|meta\[|\[id\]|\[type\]|\[required\]|utm_/.test(p))).toBe(false)
    // separador de step (título vazio) não entra
    expect(r.extra.respostas.every((p) => p.pergunta.trim() !== '' && p.resposta.trim() !== '')).toBe(true)
  })

  it('Elementor real: UTM vai para extra.utm (vazios são descartados)', () => {
    const r = normalizarLeadEntrada(elementorReal)
    // neste teste os UTM vieram vazios -> extra.utm vazio, e não poluem respostas
    expect(Object.keys(r.extra.utm)).toHaveLength(0)
  })

  it('UTM preenchido é capturado em extra.utm', () => {
    const r = normalizarLeadEntrada({
      'fields[name][title]': 'Seu Nome',
      'fields[name][value]': 'Ana',
      'fields[utm_source][title]': 'utm_source',
      'fields[utm_source][value]': 'ig',
      'fields[utm_source][type]': 'hidden',
      'fields[utm_campaign][value]': 'clinicas-julho',
    })
    expect(r.extra.utm.utm_source).toBe('ig')
    expect(r.extra.utm.utm_campaign).toBe('clinicas-julho')
    expect(r.extra.respostas.some((p) => /utm/.test(p.pergunta))).toBe(false)
  })

  it('Elementor flat (Advanced Data OFF) também mapeia', () => {
    const r = normalizarLeadEntrada({
      'form_fields[Seu Nome]': 'João Silva',
      'form_fields[Seu WhatsApp]': '11988887777',
      'form_fields[Seu E-mail]': 'joao@clinica.com',
    })
    expect(r.nome).toBe('João Silva')
    expect(r.telefone).toBe('11988887777')
    expect(r.email).toBe('joao@clinica.com')
  })

  it('email inválido não vira email; nome ainda resolve', () => {
    const r = normalizarLeadEntrada({
      'fields[a][title]': 'Seu Nome',
      'fields[a][value]': 'Carlos',
      'fields[b][title]': 'Seu E-mail',
      'fields[b][value]': 'nao-e-email',
    })
    expect(r.nome).toBe('Carlos')
    expect(r.email).toBeUndefined()
  })

  it('sem campo de nome: cai para telefone, depois email, depois "Lead sem nome"', () => {
    expect(
      normalizarLeadEntrada({ 'fields[a][title]': 'Seu WhatsApp', 'fields[a][value]': '1191234' }).nome,
    ).toBe('1191234')
    expect(normalizarLeadEntrada({ page_url: 'https://x' }).nome).toBe('Lead sem nome')
  })

  it('fonte inválida/ausente assume landing_page; válida é respeitada', () => {
    expect(normalizarLeadEntrada({ 'fields[a][title]': 'Nome', 'fields[a][value]': 'X' }).fonte).toBe('landing_page')
    expect(normalizarLeadEntrada({ fonte: 'meta_lead_ad', 'fields[a][title]': 'Nome', 'fields[a][value]': 'X' }).fonte).toBe('meta_lead_ad')
    expect(normalizarLeadEntrada({ fonte: 'xpto', 'fields[a][title]': 'Nome', 'fields[a][value]': 'X' }).fonte).toBe('landing_page')
  })

  it('guarda o payload cru inteiro em extra.raw', () => {
    const r = normalizarLeadEntrada(elementorReal)
    expect(r.extra.raw['form[name]']).toBe('Dados de Contato')
    expect(r.extra.raw['fields[name][value]']).toBe('Jack teste')
  })
})
