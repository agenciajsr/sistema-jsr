// Regras PURAS de cobrança (Fase 5 Parte 1 — Asaas). Zero import de db/react:
// tudo recebe e devolve strings 'YYYY-MM-DD' / 'YYYY-MM' (fuso BR resolvido
// pelo chamador via hojeBrasilia()). Testado em regras.test.ts.

/** Modo de cobrança por cliente (0033). */
export type ModoCobranca = 'automatico_asaas' | 'manual_pix'

/**
 * true SOMENTE se o cliente está explicitamente em modo automático via Asaas.
 * Qualquer outro valor (manual_pix, nulo, legado desconhecido) → false:
 * nunca cobrar taxa do Asaas por engano.
 */
export function deveUsarAsaas(cliente: { modoCobranca: string | null }): boolean {
  return cliente.modoCobranca === 'automatico_asaas'
}

/** Extrai a competência 'YYYY-MM' de uma data 'YYYY-MM-DD'. */
export function competenciaDe(dataIso: string): string {
  return dataIso.slice(0, 7)
}

/** Último dia (número) de uma competência 'YYYY-MM'. */
function ultimoDiaDoMes(competencia: string): number {
  const [ano, mes] = competencia.split('-').map(Number)
  // dia 0 do mês seguinte = último dia do mês (âncora UTC, sem fuso)
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/** Competência seguinte a 'YYYY-MM'. */
function competenciaSeguinte(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes, 1)) // mes é 1-based aqui → já é o próximo
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Data de vencimento da cobrança de uma competência.
 * - `diaPagamento` do cliente grampeado ao último dia do mês (31 → 28 em fev);
 * - sem diaPagamento, usa o dia da dataInicio do contrato (também grampeado);
 * - nunca retorna data no passado: mínimo = hoje (sem carência inventada).
 */
export function dataVencimento(
  competencia: string,
  diaPagamento: number | null,
  dataInicioContrato: string,
  hoje: string,
): string {
  const diaAlvo = diaPagamento ?? Number(dataInicioContrato.slice(8, 10))
  const dia = Math.min(diaAlvo, ultimoDiaDoMes(competencia))
  const vencimento = `${competencia}-${String(dia).padStart(2, '0')}`
  return vencimento < hoje ? hoje : vencimento
}

export type ContratoParaElegibilidade = {
  statusFluxo: string | null
  dataInicio: string
  dataVencimento: string
}

/** Elegível = assinado E hoje dentro da vigência [dataInicio, dataVencimento]. */
export function contratoElegivel(contrato: ContratoParaElegibilidade, hoje: string): boolean {
  return (
    contrato.statusFluxo === 'assinado' &&
    hoje >= contrato.dataInicio &&
    hoje <= contrato.dataVencimento
  )
}

export type ContratoParaCompetencias = {
  dataInicio: string
  dataVencimento: string
  /** 'YYYY-MM-DD' no fuso BR, ou null (contrato sem registro de assinatura). */
  assinadoEm: string | null
}

/**
 * Competências ainda sem cobrança, de max(mês da assinatura, mês da dataInicio)
 * até o mês atual — recupera meses perdidos se o cron falhar — sem passar do
 * mês de dataVencimento do contrato. Nunca cobra retroativo a antes da
 * assinatura nem antes do início do contrato.
 */
export function competenciasPendentes(
  contrato: ContratoParaCompetencias,
  competenciasJaGeradas: string[],
  hoje: string,
): string[] {
  const inicioContrato = competenciaDe(contrato.dataInicio)
  const inicioAssinatura = contrato.assinadoEm ? competenciaDe(contrato.assinadoEm) : inicioContrato
  const primeira = inicioAssinatura > inicioContrato ? inicioAssinatura : inicioContrato

  const atual = competenciaDe(hoje)
  const limite = competenciaDe(contrato.dataVencimento)
  const ultima = atual < limite ? atual : limite

  const geradas = new Set(competenciasJaGeradas)
  const pendentes: string[] = []
  for (let c = primeira; c <= ultima; c = competenciaSeguinte(c)) {
    if (!geradas.has(c)) pendentes.push(c)
  }
  return pendentes
}
