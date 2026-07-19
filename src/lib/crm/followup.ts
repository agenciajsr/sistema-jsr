// Regras PURAS do follow-up de vendas do CRM (quick-260719-s3a) — zero import
// de db/react/next; quem consulta o banco é dados.ts e as actions.
//
// Decisão do usuário (CONTEXT 260719-s3a): leads que não respondem ao 1º
// contato entram numa cadência de follow-ups D1..D6 com prazos CRESCENTES:
//   Contato Feito → D1: 24h sem follow-up = pendente
//   D1→D2 48h · D2→D3 72h · D3→D4 5 dias · D4→D5 7 dias · D5→D6 14 dias
//   D6 vencido há 14 dias = "Follow-ups esgotados" (destaque no card).
// NUNCA perde lead automaticamente — mover para Perdido é decisão humana.
//
// O nível vive em crm_oportunidades.followup_nivel (migration 0037) e o
// carimbo do último follow-up em ultimo_followup_em. Sair da etapa NÃO zera
// nada (histórico preservado); a visão D1..D6 só mostra quem ESTÁ na etapa.

/**
 * Prazo em HORAS que corre APÓS o follow-up de nível n (carimbo
 * ultimo_followup_em). Nível 6 usa 14 dias para virar "esgotado".
 */
export const PRAZOS_FOLLOWUP_HORAS: Record<number, number> = {
  1: 48, // D1→D2 em 48h
  2: 72, // D2→D3 em 72h
  3: 120, // D3→D4 em 5 dias
  4: 168, // D4→D5 em 7 dias
  5: 336, // D5→D6 em 14 dias
  6: 336, // D6 vencido há 14 dias = esgotado
}

/** Pendência de 24h em Contato Feito antes de entrar no fluxo (D1). */
const PRAZO_ENTRADA_HORAS = 24

const MS_POR_HORA = 60 * 60 * 1000

/** Remove diacríticos (NFD + faixa de combinantes), apara espaços e baixa a caixa. */
function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * true quando o nome da etapa é "Follow-up" — tolerante a acento/caixa/espaços
 * e às grafias 'follow up', 'follow-up' e 'followup' (hífen/espaço removidos
 * antes de comparar). Detecção por NOME porque etapas não têm chave semântica.
 */
export function ehEtapaFollowup(nome: string): boolean {
  return normalizar(nome).replace(/[\s-]/g, '') === 'followup'
}

/** true somente quando o nome da etapa é "Contato Feito" (tolerante a acento/caixa/espaços). */
export function ehEtapaContatoFeito(nome: string): boolean {
  return normalizar(nome) === 'contato feito'
}

export type PendenciaFollowup = { tipo: 'pendente' | 'esgotado'; texto: string } | null

/** Converte Date | string ISO em ms; null quando ausente. */
function paraMs(valor: Date | string | null): number | null {
  if (valor == null) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  const ms = d.getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Calcula a pendência de follow-up de um card. Regras:
 * - Só status 'aberta' pende (ganho/perdido nunca).
 * - Em "Contato Feito" (nível null): pendente após 24h desde baseContatoFeito
 *   (primeiro_contato_em, fallback createdAt — resolvido por quem chama).
 * - Em "Follow-up" nível 1-5: pendente após PRAZOS_FOLLOWUP_HORAS[nivel]
 *   desde ultimoFollowupEm.
 * - Nível 6: 'esgotado' após 14 dias (decisão HUMANA mover para Perdido).
 * Limite EM PONTO conta como vencido (mesma convenção do estourouSla).
 */
export function pendenciaFollowup(
  p: {
    status: string
    etapaNome: string | null
    followupNivel: number | null
    ultimoFollowupEm: Date | string | null
    baseContatoFeito: Date | string | null
  },
  agora: Date = new Date(),
): PendenciaFollowup {
  if (p.status !== 'aberta') return null
  const etapa = p.etapaNome ?? ''

  // Entrada no fluxo: em Contato Feito ainda sem nível, 24h desde a base.
  if (ehEtapaContatoFeito(etapa) && p.followupNivel == null) {
    const base = paraMs(p.baseContatoFeito)
    if (base == null) return null
    const horas = (agora.getTime() - base) / MS_POR_HORA
    return horas >= PRAZO_ENTRADA_HORAS ? { tipo: 'pendente', texto: 'Follow-up pendente' } : null
  }

  // Dentro do fluxo: só quem ESTÁ na etapa Follow-up com nível válido.
  if (!ehEtapaFollowup(etapa)) return null
  const nivel = p.followupNivel
  if (nivel == null || nivel < 1 || nivel > 6) return null

  const ultimo = paraMs(p.ultimoFollowupEm)
  if (ultimo == null) return null
  const horas = (agora.getTime() - ultimo) / MS_POR_HORA
  if (horas < PRAZOS_FOLLOWUP_HORAS[nivel]) return null

  return nivel >= 6
    ? { tipo: 'esgotado', texto: 'Follow-ups esgotados' }
    : { tipo: 'pendente', texto: 'Follow-up pendente' }
}
