import { describe, expect, it } from 'vitest'

import {
  CANAIS_AQUISICAO,
  cacAcumulado,
  cacPorCanal,
  canalDaOrigemCrm,
  classificarCanal,
  relacaoLtvCac,
  resolverCanalCliente,
  type ClienteGanho,
  type InvestimentoCanal,
  type ResultadoCac,
} from './cac'

// Helpers de fábrica — cada teste sobrescreve só o que importa.
function inv(over: Partial<InvestimentoCanal> = {}): InvestimentoCanal {
  return { canal: 'meta_ads', competencia: '2026-07', valor: 1000, ...over }
}
function ganho(over: Partial<ClienteGanho> = {}): ClienteGanho {
  return { origem: 'Instagram', inicio: '2026-07-10', ...over }
}

// Localiza o resultado de um canal específico no array porCanal.
function canal(resultado: ResultadoCac, chave: string) {
  return resultado.porCanal.find((c) => c.canal === chave)!
}

describe('classificarCanal', () => {
  it('Instagram/anúncio → meta_ads (case e acento-insensível)', () => {
    expect(classificarCanal('veio pelo Instagram')).toBe('meta_ads')
    expect(classificarCanal('Anúncio no Face')).toBe('meta_ads')
    expect(classificarCanal('FACEBOOK')).toBe('meta_ads')
  })

  it('google/pesquisa → google_ads', () => {
    expect(classificarCanal('Google')).toBe('google_ads')
    expect(classificarCanal('pesquisa no google')).toBe('google_ads')
  })

  it('indicação → indicacao', () => {
    expect(classificarCanal('indicação de cliente')).toBe('indicacao')
    expect(classificarCanal('Foi indicado por um amigo')).toBe('indicacao')
  })

  it('prospecção/outbound → prospeccao', () => {
    expect(classificarCanal('prospecção ativa')).toBe('prospeccao')
    expect(classificarCanal('outbound')).toBe('prospeccao')
  })

  it('orgânico/site → organico', () => {
    expect(classificarCanal('orgânico')).toBe('organico')
    expect(classificarCanal('pelo site da agência')).toBe('organico')
  })

  it('vazio/null/desconhecido → outro', () => {
    expect(classificarCanal('')).toBe('outro')
    expect(classificarCanal(null)).toBe('outro')
    expect(classificarCanal('   ')).toBe('outro')
    expect(classificarCanal('sei lá')).toBe('outro')
  })
})

describe('canalDaOrigemCrm', () => {
  it('mapeia as origens estruturadas PAGAS/orgânica do CRM para o canal canônico', () => {
    expect(canalDaOrigemCrm('meta_lead_ad')).toBe('meta_ads')
    expect(canalDaOrigemCrm('indicacao')).toBe('indicacao')
    expect(canalDaOrigemCrm('prospeccao_fria')).toBe('prospeccao')
    // Instagram no CRM é o ORGÂNICO (o Meta PAGO é meta_lead_ad).
    expect(canalDaOrigemCrm('instagram')).toBe('organico')
  })

  it('origens do CRM que não identificam canal → null (deixa a reserva decidir)', () => {
    expect(canalDaOrigemCrm('landing_page')).toBeNull()
    expect(canalDaOrigemCrm('whatsapp')).toBeNull()
    expect(canalDaOrigemCrm('evento')).toBeNull()
    expect(canalDaOrigemCrm('parceria')).toBeNull()
    expect(canalDaOrigemCrm('manual')).toBeNull()
    expect(canalDaOrigemCrm('outro')).toBeNull()
  })

  it('sem vínculo / valor desconhecido → null', () => {
    expect(canalDaOrigemCrm(null)).toBeNull()
    expect(canalDaOrigemCrm('')).toBeNull()
    expect(canalDaOrigemCrm('valor_desconhecido')).toBeNull()
  })
})

describe('resolverCanalCliente', () => {
  it('origem estruturada PAGA do CRM vence o texto livre', () => {
    expect(resolverCanalCliente('meta_lead_ad', 'Amigo')).toBe('meta_ads')
  })

  it('origem CRM que não identifica canal cai na reserva do texto livre', () => {
    expect(resolverCanalCliente('landing_page', 'Foi um amigo que indicou')).toBe('indicacao')
  })

  it('sem vínculo no CRM → classifica só pelo texto livre', () => {
    expect(resolverCanalCliente(null, 'Google')).toBe('google_ads')
  })

  it('Instagram orgânico via CRM independe do texto livre', () => {
    expect(resolverCanalCliente('instagram', 'sei lá')).toBe('organico')
  })

  it('quando nada resolve, cai no fallback "outro"', () => {
    expect(resolverCanalCliente(null, null)).toBe('outro')
    expect(resolverCanalCliente('manual', 'xxxx')).toBe('outro')
  })
})

describe('cacPorCanal', () => {
  it('CAC do canal = investimento ÷ clientes ganhos classificados nesse canal', () => {
    const investimentos = [inv({ canal: 'meta_ads', valor: 3000 })]
    const clientes = [
      ganho({ origem: 'Instagram', inicio: '2026-07-05' }),
      ganho({ origem: 'anúncio no facebook', inicio: '2026-07-20' }),
      ganho({ origem: 'anúncio', inicio: '2026-07-25' }),
    ]
    const r = cacPorCanal(investimentos, clientes, '2026-07')
    const meta = canal(r, 'meta_ads')
    expect(meta.investimento).toBe(3000)
    expect(meta.clientesGanhos).toBe(3)
    expect(meta.cac).toBe(1000)
  })

  it('canal COM investimento e SEM cliente ganho → cac null (nunca ÷0, nunca 0)', () => {
    const r = cacPorCanal([inv({ canal: 'google_ads', valor: 500 })], [], '2026-07')
    const google = canal(r, 'google_ads')
    expect(google.investimento).toBe(500)
    expect(google.clientesGanhos).toBe(0)
    expect(google.cac).toBeNull()
  })

  it('todos os canais canônicos aparecem no resultado, mesmo zerados', () => {
    const r = cacPorCanal([], [], '2026-07')
    expect(r.porCanal.map((c) => c.canal).sort()).toEqual([...CANAIS_AQUISICAO].sort())
  })

  it('só conta clientes cujo início cai na competência', () => {
    const clientes = [
      ganho({ origem: 'Instagram', inicio: '2026-06-30' }), // fora
      ganho({ origem: 'Instagram', inicio: '2026-07-01' }), // dentro
      ganho({ origem: 'Instagram', inicio: '2026-08-01' }), // fora
    ]
    const r = cacPorCanal([inv({ canal: 'meta_ads', valor: 800 })], clientes, '2026-07')
    const meta = canal(r, 'meta_ads')
    expect(meta.clientesGanhos).toBe(1)
    expect(meta.cac).toBe(800)
  })

  it('cliente sem início conhecido é ignorado', () => {
    const r = cacPorCanal(
      [inv({ canal: 'meta_ads', valor: 800 })],
      [ganho({ origem: 'Instagram', inicio: null })],
      '2026-07',
    )
    expect(canal(r, 'meta_ads').clientesGanhos).toBe(0)
  })

  it('cacGeral = total investido ÷ total de clientes ganhos no período', () => {
    const investimentos = [
      inv({ canal: 'meta_ads', valor: 2000 }),
      inv({ canal: 'google_ads', valor: 2000 }),
    ]
    const clientes = [
      ganho({ origem: 'Instagram', inicio: '2026-07-05' }),
      ganho({ origem: 'Google', inicio: '2026-07-06' }),
      ganho({ origem: 'indicação', inicio: '2026-07-07' }),
      ganho({ origem: 'Google', inicio: '2026-07-08' }),
    ]
    const r = cacPorCanal(investimentos, clientes, '2026-07')
    expect(r.investimentoTotal).toBe(4000)
    expect(r.clientesGanhosTotal).toBe(4)
    expect(r.cacGeral).toBe(1000)
  })

  it('cacGeral null quando não há cliente ganho no período', () => {
    const r = cacPorCanal([inv({ valor: 500 })], [], '2026-07')
    expect(r.cacGeral).toBeNull()
  })

  it('arredonda o CAC para 2 casas', () => {
    const clientes = [
      ganho({ inicio: '2026-07-01' }),
      ganho({ inicio: '2026-07-02' }),
      ganho({ inicio: '2026-07-03' }),
    ]
    const r = cacPorCanal([inv({ canal: 'meta_ads', valor: 1000 })], clientes, '2026-07')
    expect(canal(r, 'meta_ads').cac).toBe(333.33)
  })
})

describe('cacAcumulado', () => {
  const investimentos = [
    inv({ canal: 'meta_ads', competencia: '2026-05', valor: 1000 }),
    inv({ canal: 'meta_ads', competencia: '2026-06', valor: 1000 }),
    inv({ canal: 'meta_ads', competencia: '2026-07', valor: 1000 }),
    inv({ canal: 'meta_ads', competencia: '2026-02', valor: 5000 }), // fora da janela 3m
  ]
  const clientes = [
    ganho({ origem: 'Instagram', inicio: '2026-05-10' }),
    ganho({ origem: 'Instagram', inicio: '2026-06-10' }),
    ganho({ origem: 'Instagram', inicio: '2026-07-10' }),
    ganho({ origem: 'Instagram', inicio: '2026-02-10' }), // fora da janela 3m
  ]

  it('janela de 3 meses terminando em 2026-07 soma mai/jun/jul', () => {
    const r = cacAcumulado(investimentos, clientes, '2026-07', 3)
    const meta = canal(r, 'meta_ads')
    expect(meta.investimento).toBe(3000)
    expect(meta.clientesGanhos).toBe(3)
    expect(meta.cac).toBe(1000)
  })

  it('janela de 6 meses terminando em 2026-07 alcança fevereiro', () => {
    const r = cacAcumulado(investimentos, clientes, '2026-07', 6)
    const meta = canal(r, 'meta_ads')
    expect(meta.investimento).toBe(8000)
    expect(meta.clientesGanhos).toBe(4)
    expect(meta.cac).toBe(2000)
  })
})

describe('relacaoLtvCac', () => {
  it('LTV ÷ CAC geral', () => {
    expect(relacaoLtvCac(3000, 1000)).toBe(3)
    expect(relacaoLtvCac(4500, 1000)).toBe(4.5)
  })

  it('null quando cacGeral é 0 ou null (nunca ÷0)', () => {
    expect(relacaoLtvCac(3000, 0)).toBeNull()
    expect(relacaoLtvCac(3000, null)).toBeNull()
  })

  it('null quando o LTV é desconhecido', () => {
    expect(relacaoLtvCac(null, 1000)).toBeNull()
  })
})
