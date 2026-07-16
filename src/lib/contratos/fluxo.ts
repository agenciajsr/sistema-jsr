// Fluxo do contrato (Fase 4 Parte 1) — módulo PURO: pode importar node:crypto,
// mas ZERO import de db/auth/react. Datas trafegam como strings 'YYYY-MM-DD'
// e a aritmética usa date-fns em data local (nunca new Date('YYYY-MM-DD'),
// que interpreta UTC e desloca o dia no fuso de Brasília).

import { randomBytes } from 'node:crypto'
import { addMonths } from 'date-fns'

export type StatusFluxo =
  | 'aguardando_dados'
  | 'dados_recebidos'
  | 'aguardando_assinatura'
  | 'assinado'

// Rótulo pt-BR + classes de badge (com variante dark: — memória dark-mode).
export const STATUS_FLUXO: Record<StatusFluxo, { rotulo: string; badge: string }> = {
  aguardando_dados: {
    rotulo: 'Aguardando dados',
    badge:
      'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-500/15 dark:text-amber-400',
  },
  dados_recebidos: {
    rotulo: 'Dados recebidos',
    badge: 'bg-blue-100 text-blue-800 border-transparent dark:bg-blue-500/15 dark:text-blue-400',
  },
  aguardando_assinatura: {
    rotulo: 'Aguardando assinatura',
    badge:
      'bg-violet-100 text-violet-800 border-transparent dark:bg-violet-500/15 dark:text-violet-400',
  },
  assinado: {
    rotulo: 'Assinado',
    badge:
      'bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-500/15 dark:text-emerald-400',
  },
}

// Badge neutro para contrato legado (sem status_fluxo — cadastrado na mão).
const BADGE_LEGADO = 'bg-muted text-muted-foreground border-transparent'

/** Rótulo do status; nulo/desconhecido (contrato legado) → 'Manual'. */
export function rotuloStatusFluxo(status: string | null | undefined): string {
  if (!status) return 'Manual'
  return STATUS_FLUXO[status as StatusFluxo]?.rotulo ?? 'Manual'
}

/** Classes de badge do status; legado → badge neutro. */
export function badgeStatusFluxo(status: string | null | undefined): string {
  if (!status) return BADGE_LEGADO
  return STATUS_FLUXO[status as StatusFluxo]?.badge ?? BADGE_LEGADO
}

/** Rótulo do tipo de documento; nulo → 'Contrato'; desconhecido → capitalizado. */
export function rotuloTipoDocumento(tipo: string | null | undefined): string {
  if (!tipo) return 'Contrato'
  if (tipo === 'aditivo') return 'Aditivo'
  if (tipo === 'contrato') return 'Contrato'
  return tipo.charAt(0).toUpperCase() + tipo.slice(1)
}

/** Formata uma Date local como 'YYYY-MM-DD' sem passar por UTC. */
function formatarIsoLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Monta as datas e o valor do contrato criado na conversão Ganho → Cliente.
 * dataInicio = hoje; dataVencimento = hoje + duracaoMeses (addMonths grampeia
 * fim de mês: 31/ago + 6 → 28/fev). valorMensal como string com 2 casas
 * (coluna numeric — dinheiro NUNCA float).
 */
export function montarDadosContrato({
  duracaoMeses,
  mensalidade,
  hoje,
}: {
  duracaoMeses: number
  mensalidade: number
  hoje: string
}): { dataInicio: string; dataVencimento: string; valorMensal: string } {
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const inicio = new Date(ano, mes - 1, dia)
  const vencimento = addMonths(inicio, duracaoMeses)
  return {
    dataInicio: hoje,
    dataVencimento: formatarIsoLocal(vencimento),
    valorMensal: mensalidade.toFixed(2),
  }
}

/** Token imprevisível e seguro para URL (43 chars base64url = 256 bits). */
export function gerarToken(): string {
  return randomBytes(32).toString('base64url')
}
