/** Data de HOJE no fuso de Brasília, formato 'YYYY-MM-DD'. en-CA => ISO. */
export function hojeBrasilia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Subtrai n dias de uma data-base 'YYYY-MM-DD' (default: hoje-BR), retorna 'YYYY-MM-DD'.
 *  Usa meio-dia UTC como âncora para não sofrer com bordas de fuso/DST. */
export function dataMenosDias(n: number, base: string = hojeBrasilia()): string {
  const d = new Date(`${base}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
