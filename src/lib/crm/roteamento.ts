// Roteamento de leads na ingestão: decide se um lead nasce no funil de VENDAS
// (inbound, comportamento atual) ou no funil separado de PROSPECÇÃO FRIA.
//
// Módulo PURO de propósito: zero import de db/auth/react — só constantes e a
// decisão por fonte. Isso torna a regra testável sem banco e garante que a
// mesma decisão não divirja entre a API pública e qualquer entrada futura.

/** Nome pt-BR EXATO do pipeline de prospecção fria (casado no seed idempotente). */
export const NOME_PIPELINE_FRIO = 'Prospecção Fria'

/** Etapa em que o lead frio NOVO nasce (ordem 0 do funil Frio). */
export const ETAPA_INICIAL_FRIO = 'A Abordar'

/**
 * true SOMENTE para a fonte 'prospeccao_fria'.
 *
 * O disparo frio (prospecção ativa por ferramenta externa) NÃO deve poluir o
 * funil de Vendas, que existe para o inbound de valor real. Só essa fonte isola
 * para o funil Frio; QUALQUER outra fonte — inclusive uma nova adicionada no
 * futuro ou um valor desconhecido — permanece no comportamento atual (pipeline
 * padrão "Vendas"). Comparação estrita, sem normalização: a fonte já chega
 * validada pelo enum FONTES_LEAD, então não há variação de caixa/acento a tratar.
 */
export function ehLeadFrio(fonte: string): boolean {
  return fonte === 'prospeccao_fria'
}
