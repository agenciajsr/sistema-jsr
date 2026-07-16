// Motivos de perda PADRONIZADOS do CRM (lista travada pelo usuário — quick
// 260716-khp). Módulo PURO: zero imports de db/auth/react (decisão 260714-ita),
// para a regra ser testável sem banco e compartilhada entre dialog e kanban.
//
// O valor persistido em crm_oportunidades.motivo_perda (coluna text existente)
// é o rótulo em si, ou "Outro: {detalhe}" — sem migration.

export const MOTIVOS_PERDA = [
  'Preço alto',
  'Sem verba no momento',
  'Fechou com concorrente',
  'Sem resposta/sumiu',
  'Timing errado (voltar depois)',
  'Não qualificado',
  'Outro',
] as const

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number]

/**
 * Monta a string final a persistir na coluna `motivo_perda`.
 *
 * - Motivo da lista (≠ Outro) → o próprio rótulo (detalhe é ignorado).
 * - "Outro" → exige detalhe não-vazio; devolve "Outro: {detalhe trimado}".
 * - Motivo fora da lista, ou "Outro" sem detalhe → null (inválido).
 */
export function montarMotivoPerda(motivo: string, detalhe?: string): string | null {
  if (!(MOTIVOS_PERDA as readonly string[]).includes(motivo)) return null
  if (motivo !== 'Outro') return motivo
  const texto = detalhe?.trim()
  if (!texto) return null
  return `Outro: ${texto}`
}
