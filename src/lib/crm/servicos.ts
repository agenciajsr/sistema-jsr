// Modulo PURO (zero import de db/react): a lista FECHADA dos servicos da JSR.
//
// D-06: servico NAO vira tabela. A agencia vende 4 coisas e essa lista muda
// raramente — uma constante deixa o valor auditavel no diff, sem join, sem
// seed e sem CRUD para manter. A chave ('trafego_pago') e o que fica gravado
// em crm_oportunidades.servico; o rotulo e so apresentacao.

export const SERVICOS_JSR = {
  trafego_pago: 'Trafego Pago',
  landing_page: 'Landing Page e Site',
  crm_automacao: 'CRM e Automacao',
  estrategia: 'Estrategia e Estruturacao',
} as const

export type ServicoJsr = keyof typeof SERVICOS_JSR

// Tupla NAO-VAZIA: e o formato que z.enum(...) exige.
export const SERVICOS_KEYS = Object.keys(SERVICOS_JSR) as [ServicoJsr, ...ServicoJsr[]]

/** Rotulo do servico para a UI. Chave desconhecida/nula -> 'Sem servico'. */
export function rotuloServico(v: string | null | undefined): string {
  if (!v) return 'Sem servico'
  return SERVICOS_JSR[v as ServicoJsr] ?? 'Sem servico'
}
