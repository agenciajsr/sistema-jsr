// Validação e máscara de CPF/CNPJ. O documento alimenta contrato e o cadastro
// no Asaas (cobrança automática) — um dígito errado vira boleto com dado errado,
// então validamos os dígitos verificadores na digitação, não só o formato.

/** Só dígitos. */
export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

/** CPF: 11 dígitos + dígitos verificadores válidos (rejeita sequências repetidas). */
export function validarCPF(valor: string): boolean {
  const d = somenteDigitos(valor)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i)
  let dv1 = ((soma * 10) % 11) % 10
  if (dv1 !== Number(d[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i)
  const dv2 = ((soma * 10) % 11) % 10
  return dv2 === Number(d[10])
}

/** CNPJ: 14 dígitos + dígitos verificadores válidos (rejeita sequências repetidas). */
export function validarCNPJ(valor: string): boolean {
  const d = somenteDigitos(valor)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const calc = (base: string, pesos: number[]): number => {
    const soma = pesos.reduce((acc, p, i) => acc + Number(base[i]) * p, 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const dv1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (dv1 !== Number(d[12])) return false
  const dv2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return dv2 === Number(d[13])
}

/** Máscara progressiva de CPF: 000.000.000-00. */
export function mascararCPF(v: string): string {
  const d = somenteDigitos(v).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Máscara progressiva de CNPJ: 00.000.000/0000-00. */
export function mascararCNPJ(v: string): string {
  const d = somenteDigitos(v).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Máscara conforme o tipo de pessoa. */
export function mascararDocumento(tipo: 'fisica' | 'juridica', v: string): string {
  return tipo === 'fisica' ? mascararCPF(v) : mascararCNPJ(v)
}

/** Máscara de CEP: 00000-000. */
export function mascararCEP(v: string): string {
  const d = somenteDigitos(v).slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`
}
