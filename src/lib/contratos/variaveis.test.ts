import { describe, it, expect } from 'vitest'

import { montarVariaveisContrato } from './variaveis'
import { montarSecoesContrato, tituloContrato, trechosDoParagrafo } from './template-trafego'

const dadosPj = {
  tipo: 'pj' as const,
  razaoSocial: 'Padaria Central LTDA',
  cnpj: '11444777000161',
  enderecoSede: 'Rua das Flores, 100, Salvador - BA',
  telefone: '(71) 99999-0000',
  nomeRepresentante: 'Maria Souza',
  nacionalidade: 'brasileira',
  estadoCivil: 'casada',
  profissao: 'empresária',
  cpf: '52998224725',
  enderecoRepresentante: 'Av. Sete, 200, Salvador - BA',
  email: 'maria@padaria.com',
}

const dadosPf = {
  tipo: 'pf' as const,
  nomeCompleto: 'João da Silva',
  cpf: '529.982.247-25',
  nacionalidade: 'brasileiro',
  estadoCivil: 'solteiro',
  profissao: 'dentista',
  endereco: 'Rua A, 10, Salvador - BA',
  telefone: '(71) 98888-0000',
  email: 'joao@exemplo.com',
}

const contratoBase = {
  dataInicio: '2026-07-16',
  dataVencimento: '2026-10-16',
  valorMensal: '1500.00',
  duracaoMeses: 3,
}

describe('montarVariaveisContrato', () => {
  it('monta a qualificação completa de PJ com CNPJ e CPF formatados', () => {
    const r = montarVariaveisContrato({ contrato: contratoBase, dadosContratante: dadosPj })
    if ('error' in r) throw new Error(r.error)
    expect(r.data.qualificacaoContratante).toContain('Padaria Central LTDA')
    expect(r.data.qualificacaoContratante).toContain('pessoa jurídica de direito privado')
    expect(r.data.qualificacaoContratante).toContain('11.444.777/0001-61')
    expect(r.data.qualificacaoContratante).toContain('representada por Maria Souza')
    expect(r.data.qualificacaoContratante).toContain('529.982.247-25')
    expect(r.data.qualificacaoContratante).toContain('Av. Sete, 200')
    expect(r.data.nomeSignatario).toBe('Maria Souza')
    expect(r.data.cpfSignatario).toBe('529.982.247-25')
    expect(r.data.emailSignatario).toBe('maria@padaria.com')
  })

  it('monta a qualificação de PF', () => {
    const r = montarVariaveisContrato({ contrato: contratoBase, dadosContratante: dadosPf })
    if ('error' in r) throw new Error(r.error)
    expect(r.data.qualificacaoContratante).toContain('João da Silva')
    expect(r.data.qualificacaoContratante).toContain('brasileiro')
    expect(r.data.qualificacaoContratante).toContain('529.982.247-25')
    expect(r.data.qualificacaoContratante).not.toContain('pessoa jurídica')
    expect(r.data.nomeSignatario).toBe('João da Silva')
  })

  it('formata CPF/CNPJ tanto de dígitos crus quanto já mascarados', () => {
    const cru = montarVariaveisContrato({ contrato: contratoBase, dadosContratante: dadosPj })
    const mascarado = montarVariaveisContrato({
      contrato: contratoBase,
      dadosContratante: { ...dadosPj, cnpj: '11.444.777/0001-61', cpf: '529.982.247-25' },
    })
    if ('error' in cru || 'error' in mascarado) throw new Error('não deveria falhar')
    expect(cru.data.qualificacaoContratante).toBe(mascarado.data.qualificacaoContratante)
  })

  it('formata o valor mensal em BRL (sem extenso — decisão v1)', () => {
    const r = montarVariaveisContrato({ contrato: contratoBase, dadosContratante: dadosPf })
    if ('error' in r) throw new Error(r.error)
    expect(r.data.valorMensalFormatado).toBe('R$ 1.500,00')
  })

  it('converte datas YYYY-MM-DD para DD/MM/YYYY sem passar por Date', () => {
    const r = montarVariaveisContrato({ contrato: contratoBase, dadosContratante: dadosPf })
    if ('error' in r) throw new Error(r.error)
    expect(r.data.dataInicioFormatada).toBe('16/07/2026')
    expect(r.data.dataVencimentoFormatada).toBe('16/10/2026')
  })

  it('aceita duração de 3 e 6 meses; outras duram em erro claro', () => {
    const seis = montarVariaveisContrato({
      contrato: { ...contratoBase, duracaoMeses: 6 },
      dadosContratante: dadosPf,
    })
    if ('error' in seis) throw new Error(seis.error)
    expect(seis.data.duracaoMeses).toBe(6)

    const quatro = montarVariaveisContrato({
      contrato: { ...contratoBase, duracaoMeses: 4 },
      dadosContratante: dadosPf,
    })
    expect(quatro).toHaveProperty('error')

    const nula = montarVariaveisContrato({
      contrato: { ...contratoBase, duracaoMeses: null },
      dadosContratante: dadosPf,
    })
    expect(nula).toHaveProperty('error')
  })

  it('dadosContratante ausente ou incompleto vira { error } — nunca contrato com lacuna', () => {
    const ausente = montarVariaveisContrato({ contrato: contratoBase, dadosContratante: null })
    expect(ausente).toHaveProperty('error')

    const incompleto = montarVariaveisContrato({
      contrato: contratoBase,
      dadosContratante: { ...dadosPf, nomeCompleto: '' },
    })
    expect(incompleto).toHaveProperty('error')
  })
})

// quick-260716-ky2 — serviços contratados estruturados nas variáveis/template.
const servicosMulti = [
  { servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads', 'google_ads'] },
  { servico: 'crm_automacao', valor: 800 },
]

function textoDasSecoes(secoes: ReturnType<typeof montarSecoesContrato>): string {
  return secoes
    .map((s) =>
      [s.titulo ?? '', ...s.paragrafos.map((p) => trechosDoParagrafo(p).map((t) => t.texto).join(''))].join('\n')
    )
    .join('\n')
}

describe('serviços contratados nas variáveis do contrato', () => {
  it('parseia servicos e monta as linhas de valor por serviço', () => {
    const r = montarVariaveisContrato({
      contrato: { ...contratoBase, servicos: servicosMulti },
      dadosContratante: dadosPf,
    })
    if ('error' in r) throw new Error(r.error)
    expect(r.data.servicos).toHaveLength(2)
    expect(r.data.linhasValorPorServico).toEqual([
      'Tráfego Pago (Meta Ads e Google Ads): R$ 1.500,00',
      'CRM e Automação: R$ 800,00',
    ])
  })

  it('servicos ausente/inválido → null (contrato legado)', () => {
    const semServicos = montarVariaveisContrato({
      contrato: contratoBase,
      dadosContratante: dadosPf,
    })
    if ('error' in semServicos) throw new Error(semServicos.error)
    expect(semServicos.data.servicos).toBeNull()
    expect(semServicos.data.linhasValorPorServico).toEqual([])

    const invalido = montarVariaveisContrato({
      contrato: { ...contratoBase, servicos: [{ servico: 'trafego_pago' }] },
      dadosContratante: dadosPf,
    })
    if ('error' in invalido) throw new Error(invalido.error)
    expect(invalido.data.servicos).toBeNull()
  })
})

describe('template do contrato com serviços estruturados', () => {
  function varsCom(servicos: unknown) {
    const r = montarVariaveisContrato({
      contrato: { ...contratoBase, servicos },
      dadosContratante: dadosPf,
    })
    if ('error' in r) throw new Error(r.error)
    return r.data
  }

  it('multi-serviço: objeto cita os serviços e as plataformas; 2.2 traz a composição', () => {
    const texto = textoDasSecoes(montarSecoesContrato(varsCom(servicosMulti)))
    expect(texto).toContain('Meta Ads e Google Ads')
    expect(texto).toContain('CRM e Automação')
    expect(texto).toContain('Tráfego Pago (Meta Ads e Google Ads)')
    expect(texto).toContain('2.2 O valor mensal é composto pelos seguintes serviços:')
  })

  it('multi-serviço: título vira marketing digital; só-tráfego mantém o título original', () => {
    expect(tituloContrato(varsCom(servicosMulti))).toBe(
      'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL'
    )
    expect(
      tituloContrato(
        varsCom([{ servico: 'trafego_pago', valor: 1500, plataformas: ['meta_ads'] }])
      )
    ).toBe('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRÁFEGO PAGO')
    expect(tituloContrato(varsCom(undefined))).toBe(
      'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRÁFEGO PAGO'
    )
  })

  it('sem tráfego pago entre os serviços, os itens operacionais de tráfego saem do objeto', () => {
    const texto = textoDasSecoes(
      montarSecoesContrato(varsCom([{ servico: 'crm_automacao', valor: 800 }]))
    )
    expect(texto).not.toContain('Criação e configuração inicial da conta de anúncios')
    expect(texto).not.toContain('1.3 Os primeiros 7 (sete) dias úteis')
    expect(texto).toContain('CRM e automações de atendimento')
  })

  it('legado (servicos null): texto idêntico ao atual — snapshot preservado', () => {
    const secoes = montarSecoesContrato(varsCom(undefined))
    const texto = textoDasSecoes(secoes)
    expect(texto).toContain(
      '1.1.6 O presente contrato tem por objeto a prestação de serviços de geração de tráfego pago a partir das plataformas de anúncios, sem exclusividade e sem subordinação, visando a promoção do site e/ou das mídias sociais do(a) CONTRATANTE.'
    )
    expect(texto).toContain('1.1.1 Criação e configuração inicial da conta de anúncios')
    expect(texto).toContain('1.1.5 Prestação de contas dos serviços prestados.')
    expect(texto).not.toContain('2.2 O valor mensal é composto')
    expect(texto).toContain('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRÁFEGO PAGO')
  })
})
