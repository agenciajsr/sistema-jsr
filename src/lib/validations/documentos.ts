// Validação de CPF/CNPJ com dígito verificador — módulo PURO (zero import de
// db/auth/react). Usado no formulário público /contrato/[token] (client) e na
// action pública (server): NUNCA confiar só na validação do client.

/** Remove tudo que não for dígito. */
function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** true se todos os caracteres são iguais ('11111111111' etc.). */
function todosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos)
}

/** Valida CPF (com ou sem máscara) pelo dígito verificador. */
export function validarCpf(valor: string): boolean {
  const cpf = soDigitos(valor)
  if (cpf.length !== 11 || todosIguais(cpf)) return false

  // 1º dígito: pesos 10..2 sobre os 9 primeiros.
  let soma = 0
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i)
  let dv1 = (soma * 10) % 11
  if (dv1 === 10) dv1 = 0
  if (dv1 !== Number(cpf[9])) return false

  // 2º dígito: pesos 11..2 sobre os 10 primeiros.
  soma = 0
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i)
  let dv2 = (soma * 10) % 11
  if (dv2 === 10) dv2 = 0
  return dv2 === Number(cpf[10])
}

/** Valida CNPJ (com ou sem máscara) pelo dígito verificador. */
export function validarCnpj(valor: string): boolean {
  const cnpj = soDigitos(valor)
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false

  const calcularDv = (base: string): number => {
    // Pesos do CNPJ: começam em 5 (1º dv) ou 6 (2º dv) e caem até 2, reiniciando em 9.
    let peso = base.length - 7
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso
      peso -= 1
      if (peso < 2) peso = 9
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const dv1 = calcularDv(cnpj.slice(0, 12))
  if (dv1 !== Number(cnpj[12])) return false
  const dv2 = calcularDv(cnpj.slice(0, 13))
  return dv2 === Number(cnpj[13])
}

/** Máscara progressiva de CPF: 529.982.247-25 (aceita parcial durante digitação). */
export function formatarCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Máscara progressiva de CNPJ: 11.222.333/0001-81. */
export function formatarCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
