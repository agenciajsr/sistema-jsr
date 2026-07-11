import { describe, it, expect } from 'vitest'

import { parseActions } from './aggregate'

describe('parseActions', () => {
  it('(a) conta leads simples a partir de um action_type de lead', () => {
    const r = parseActions([{ action_type: 'lead', value: '5' }])
    expect(r.leads).toBe(5)
    expect(r.vendas).toBe(0)
    expect(r.conversas).toBe(0)
    expect(r.linkClicks).toBe(0)
  })

  it('(b) dedup de compra: omni_purchase presente ao lado de purchase conta so omni_purchase', () => {
    const r = parseActions([
      { action_type: 'purchase', value: '3' },
      { action_type: 'omni_purchase', value: '10' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '3' },
    ])
    // Prioriza omni_purchase (10), nao soma os outros grupos de compra
    expect(r.vendas).toBe(10)
  })

  it('(b2) sem omni_purchase, usa purchase e ignora offsite/onsite', () => {
    const r = parseActions([
      { action_type: 'purchase', value: '4' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '9' },
    ])
    expect(r.vendas).toBe(4)
  })

  it('(c) conversas com os dois tipos nao duplica (prioriza messaging_conversation_started_7d)', () => {
    const r = parseActions([
      { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '7' },
      { action_type: 'onsite_conversion.total_messaging_connection', value: '12' },
    ])
    expect(r.conversas).toBe(7)
  })

  it('(d) actions null retorna tudo zero sem lancar', () => {
    expect(parseActions(null)).toEqual({ leads: 0, vendas: 0, conversas: 0, linkClicks: 0 })
    expect(parseActions(undefined)).toEqual({ leads: 0, vendas: 0, conversas: 0, linkClicks: 0 })
    expect(parseActions('nao-array')).toEqual({ leads: 0, vendas: 0, conversas: 0, linkClicks: 0 })
    expect(parseActions([{ foo: 'bar' }])).toEqual({ leads: 0, vendas: 0, conversas: 0, linkClicks: 0 })
  })

  it('(e) value string vira numero (parseFloat) e soma link_click', () => {
    const r = parseActions([
      { action_type: 'link_click', value: '15' },
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '2.5' },
    ])
    expect(r.linkClicks).toBe(15)
    expect(r.leads).toBe(2.5)
  })
})
