// Filtro de exibição da aba "A Receber" (quick-260717-i26).
// Módulo PURO: zero import de db/auth/react — matemática de data em strings
// 'YYYY-MM-DD' (padrão do projeto, evita ambiguidade de timezone).

export type ContaAReceberMinima = { data: string; status: string }

const JANELA_DIAS = 30

// Soma dias a uma data 'YYYY-MM-DD' sem depender de timezone local:
// Date.UTC + toISOString mantém tudo em UTC puro (determinístico em teste).
function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return d.toISOString().slice(0, 10)
}

/**
 * Filtro padrão da aba A Receber: mantém toda conta vencida + pendentes com
 * data até hoje+30 dias (inclusive). Com mostrarTodas=true devolve tudo.
 * Preserva a ordenação recebida (a query já ordena por data).
 */
export function filtrarAReceber<T extends ContaAReceberMinima>(
  contas: T[],
  hoje: string,
  mostrarTodas: boolean,
): T[] {
  if (mostrarTodas) return contas
  const limite = somarDias(hoje, JANELA_DIAS)
  return contas.filter((c) => c.status === 'vencido' || c.data <= limite)
}

// Abreviações fixas pt-BR (não depender de Intl locale no runtime).
const MESES_ABREV_PT_BR = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const

/** 'YYYY-MM' → 'ago/2026'. Entrada inválida devolve a própria string. */
export function labelMesPtBr(mesIso: string): string {
  const [ano, mes] = mesIso.split('-')
  const idx = Number(mes) - 1
  const abrev = MESES_ABREV_PT_BR[idx]
  if (!ano || !abrev) return mesIso
  return `${abrev}/${ano}`
}
