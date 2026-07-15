// Metadados de origem dos leads/oportunidades do CRM.
// `rotulo` = texto do badge no card (VIA MANUAL...); `nome` = rotulo humano na
// barra de origem; `cor` = CLASSE tailwind usada como bolinha/dot e accent.
// Origens conhecidas: crm_oportunidades.origem / crm_contatos.origem.

export type OrigemMeta = { rotulo: string; nome: string; cor: string }

export const ORIGEM_META: Record<string, OrigemMeta> = {
  manual: { rotulo: 'VIA MANUAL', nome: 'Manual', cor: 'bg-slate-500' },
  whatsapp: { rotulo: 'VIA WHATSAPP', nome: 'WhatsApp', cor: 'bg-emerald-500' },
  landing_page: { rotulo: 'VIA LANDING', nome: 'Landing page', cor: 'bg-sky-500' },
  meta_lead_ad: { rotulo: 'VIA META', nome: 'Meta Ads', cor: 'bg-blue-600' },
  indicacao: { rotulo: 'VIA INDICACAO', nome: 'Indicacao', cor: 'bg-amber-500' },
  outro: { rotulo: 'VIA OUTRO', nome: 'Outro', cor: 'bg-zinc-400' },
}

// Fallback unico para null/desconhecido: sempre cai em 'outro'.
function metaDe(origem: string | null | undefined): OrigemMeta {
  return (origem && ORIGEM_META[origem]) || ORIGEM_META.outro
}

export function rotuloOrigem(origem: string | null | undefined): string {
  return metaDe(origem).rotulo
}

export function nomeOrigem(origem: string | null | undefined): string {
  return metaDe(origem).nome
}

export function corOrigem(origem: string | null | undefined): string {
  return metaDe(origem).cor
}
