// Aritmética PURA de competência recorrente do FINANCEIRO — espelho de
// src/lib/cobrancas/regras.ts (o "certo" da casa). Zero import de db/auth/react/next.
//
// ⚠️ Datas SEMPRE como string 'YYYY-MM-DD'. Toda a aritmética é ancorada em
// MEIO-DIA UTC (mesma filosofia de src/lib/tarefas/recorrencia.ts e do
// dataMenosDias em src/lib/date-br.ts): assim nenhuma borda de fuso/DST empurra
// a data para o dia vizinho. NÃO usamos date-fns aqui (ele opera em fuso local
// e vazaria o dia), mas o clamp mensal reproduz EXATAMENTE o addMonths que
// gerava as séries hoje no banco (server UTC) — o `jaGeradas` casa com os
// filhos já existentes que sobrarem após a limpeza.

export type RecorrenciaFin = 'semanal' | 'mensal' | 'trimestral' | 'avulsa'

// --- Helpers de data (ancorados em meio-dia UTC) ---

function parse(data: string): Date {
  return new Date(`${data}T12:00:00Z`)
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Último dia (28/29/30/31) do mês de referência (ano, mês 0-based). */
function ultimoDiaDoMes(ano: number, mes0: number): number {
  // Dia 0 do mês seguinte == último dia do mês atual (âncora UTC, sem fuso).
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate()
}

/**
 * Próxima data da série a partir de `data`:
 * - semanal → +7 dias;
 * - mensal → +1 mês; trimestral → +3 meses, GRAMPEANDO o dia ao último dia do
 *   mês alvo (31/jan +1 = 28/fev; em bissexto = 29/fev; 31 → 30 em mês de 30);
 * - avulsa → devolve a própria data (o caller nunca itera avulsa).
 */
export function proximaDataRecorrente(data: string, recorrencia: RecorrenciaFin): string {
  if (recorrencia === 'avulsa') return data

  if (recorrencia === 'semanal') {
    const d = parse(data)
    d.setUTCDate(d.getUTCDate() + 7)
    return fmt(d)
  }

  const passoMeses = recorrencia === 'trimestral' ? 3 : 1
  const base = parse(data)
  const dia = base.getUTCDate()
  // Normaliza ano/mês alvo (getUTCMonth pode passar de 11).
  const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + passoMeses, 1, 12))
  const diaGrampeado = Math.min(dia, ultimoDiaDoMes(alvo.getUTCFullYear(), alvo.getUTCMonth()))
  alvo.setUTCDate(diaGrampeado)
  return fmt(alvo)
}

/**
 * Enumera as datas da série DEPOIS de `dataBase` (exclusivo), passo a passo por
 * proximaDataRecorrente, dentro de [de, ate] (inclusive), respeitando o teto
 * `dataFinal` quando != null (nunca gera data > dataFinal). avulsa → [].
 * Usada tanto pela materialização (rollover) quanto pela projeção da previsão.
 */
export function ocorrenciasRecorrentesNoIntervalo(
  dataBase: string,
  recorrencia: RecorrenciaFin,
  dataFinal: string | null,
  de: string,
  ate: string,
): string[] {
  if (recorrencia === 'avulsa') return []
  if (ate < de) return []

  const datas: string[] = []
  let atual = proximaDataRecorrente(dataBase, recorrencia)
  while (atual <= ate && (dataFinal == null || atual <= dataFinal)) {
    if (atual >= de) datas.push(atual)
    atual = proximaDataRecorrente(atual, recorrencia)
  }
  return datas
}

/**
 * Competências ainda NÃO geradas da série, de `dataBase` (exclusivo) até HOJE —
 * espelho de competenciasPendentes / ocorrenciasFaltantes: idempotente por
 * `jaGeradas`, NUNCA passa do mês atual (teto = hoje).
 *
 * - limite = (dataFinal != null && dataFinal < hoje) ? dataFinal : hoje
 *   (teto sempre hoje: nunca pré-gera futuro; contrato já vencido encerra em dataFinal);
 * - avulsa → [].
 *
 * Idempotência (D-05 do espelho): rodar 2× somando o 1º resultado a `jaGeradas`
 * devolve []. A trava final contra corrida é o índice único (transacao_pai_id, data).
 */
export function datasPendentesRecorrentes({
  dataBase,
  recorrencia,
  dataFinal,
  jaGeradas,
  hoje,
}: {
  dataBase: string
  recorrencia: RecorrenciaFin
  dataFinal: string | null
  jaGeradas: string[]
  hoje: string
}): string[] {
  if (recorrencia === 'avulsa') return []

  const limite = dataFinal != null && dataFinal < hoje ? dataFinal : hoje
  const jaExiste = new Set(jaGeradas)
  return ocorrenciasRecorrentesNoIntervalo(dataBase, recorrencia, dataFinal, dataBase, limite).filter(
    (d) => !jaExiste.has(d),
  )
}
