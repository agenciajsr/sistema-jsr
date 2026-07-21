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

/** Remove diacríticos (NFD + faixa de combinantes), apara espaços e baixa a caixa. */
function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * true quando o pipeline é o funil de PROSPECÇÃO FRIA, detectado pelo NOME
 * normalizado (tolerante a acento/caixa/espaços) == 'prospeccao fria'.
 *
 * A detecção é por NOME (e não por fonte do lead) porque a camada de dados e a de
 * alertas têm em mãos o pipeline do card, não a fonte que o originou. `normalizar`
 * é local de propósito: roteamento.ts é usado na ingestão e deve ficar autossuficiente
 * (zero import de followup.ts). null/'Vendas'/'Prospecção' e afins → false.
 */
export function ehPipelineFrio(nomePipeline: string | null): boolean {
  if (nomePipeline == null) return false
  return normalizar(nomePipeline) === normalizar(NOME_PIPELINE_FRIO)
}
