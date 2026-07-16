import { describe, expect, it } from 'vitest'

import { MOTIVOS_PERDA, montarMotivoPerda } from './motivos-perda'

describe('MOTIVOS_PERDA', () => {
  it('contém exatamente os 7 motivos padronizados, na ordem travada', () => {
    expect(MOTIVOS_PERDA).toEqual([
      'Preço alto',
      'Sem verba no momento',
      'Fechou com concorrente',
      'Sem resposta/sumiu',
      'Timing errado (voltar depois)',
      'Não qualificado',
      'Outro',
    ])
  })
})

describe('montarMotivoPerda', () => {
  it('devolve o próprio rótulo quando o motivo não é Outro', () => {
    expect(montarMotivoPerda('Preço alto')).toBe('Preço alto')
  })

  it('ignora o detalhe quando o motivo não é Outro', () => {
    expect(montarMotivoPerda('Preço alto', 'qualquer detalhe')).toBe('Preço alto')
  })

  it('Outro com detalhe devolve "Outro: {detalhe}" com trim', () => {
    expect(montarMotivoPerda('Outro', 'cliente mudou de cidade')).toBe(
      'Outro: cliente mudou de cidade',
    )
    expect(montarMotivoPerda('Outro', '  mudou de cidade  ')).toBe('Outro: mudou de cidade')
  })

  it('Outro sem detalhe (vazio ou só espaços) é inválido → null', () => {
    expect(montarMotivoPerda('Outro', '')).toBeNull()
    expect(montarMotivoPerda('Outro', '   ')).toBeNull()
    expect(montarMotivoPerda('Outro')).toBeNull()
  })

  it('motivo fora da lista é inválido → null', () => {
    expect(montarMotivoPerda('qualquer coisa fora da lista')).toBeNull()
  })
})
