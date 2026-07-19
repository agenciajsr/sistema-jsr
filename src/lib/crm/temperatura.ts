// Temperatura do lead — helper PURO origem → 🔥/🧊 (quick-260719-s3a).
//
// DECISÃO REGISTRADA: a temperatura é DERIVADA NA LEITURA (função pura da
// origem), sem coluna nova e sem backfill — leads antigos ganham o chip
// automaticamente e a origem editada na ficha (quick 260719-qf5 propaga para
// as oportunidades) mantém tudo consistente sem sincronização extra.
//
// Chaves REAIS de origem (src/lib/crm/origem.ts):
//   quente = meta_lead_ad, landing_page (anúncio/formulário — respondeu agora)
//   frio   = prospeccao_fria, whatsapp (disparo ativo — não pediu contato)
//   demais origens (manual, indicacao, instagram, ...) não têm temperatura.

export type Temperatura = 'quente' | 'frio'

const TEMPERATURA_POR_ORIGEM: Record<string, Temperatura> = {
  meta_lead_ad: 'quente',
  landing_page: 'quente',
  prospeccao_fria: 'frio',
  whatsapp: 'frio',
}

/** Temperatura derivada da origem; null quando a origem é neutra/desconhecida. */
export function temperaturaOrigem(origem: string | null | undefined): Temperatura | null {
  if (!origem) return null
  return TEMPERATURA_POR_ORIGEM[origem] ?? null
}
