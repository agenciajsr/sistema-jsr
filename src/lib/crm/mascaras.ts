// Modulo PURO (zero import de db/react): mascaras BR de telefone e documento.
// Testado em mascaras.test.ts.
//
// Ambas sao PROGRESSIVAS: rodam a cada tecla, aceitam a entrada pela metade e
// NUNCA lancam. Sao apresentacao apenas — o dedup do lead usa o telefone
// normalizado (normalizarTelefone, so digitos), nunca a string mascarada.

/** So os digitos de `v`, cortados em `max`. */
function digitos(v: string, max: number): string {
  return v.replace(/\D/g, '').slice(0, max)
}

/**
 * Telefone BR: '(31) 3234-5678' (fixo, ate 10 digitos) ou '(31) 99876-5432'
 * (celular, 11). Trunca em 11. Sem digito nenhum -> '' (nunca devolve '(').
 */
export function mascararTelefone(v: string): string {
  const d = digitos(v, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`

  const ddd = d.slice(0, 2)
  if (d.length <= 6) return `(${ddd}) ${d.slice(2)}`
  // 11 digitos = celular (5 antes do hifen); ate 10 = fixo (4 antes do hifen).
  const corte = d.length === 11 ? 7 : 6
  return `(${ddd}) ${d.slice(2, corte)}-${d.slice(corte)}`
}

/**
 * Documento BR: CPF '123.456.789-01' (ate 11 digitos) ou CNPJ
 * '12.345.678/0001-99' (12 a 14). Trunca em 14. Vazio -> ''.
 */
export function mascararDocumento(v: string): string {
  const d = digitos(v, 14)
  if (d.length === 0) return ''

  if (d.length <= 11) {
    // CPF, formatado conforme o usuario digita.
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }

  // CNPJ (12+ digitos).
  const base = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}`
  return d.length <= 12 ? base : `${base}-${d.slice(12)}`
}
