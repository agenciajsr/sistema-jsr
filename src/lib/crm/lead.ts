import { createHash } from 'node:crypto'

// Módulo PURO do CRM (zero import de db/auth/react): normalização de telefone
// e hash de deduplicação de leads. Testado em lead.test.ts.

/**
 * Normaliza um telefone para SÓ DÍGITOS ('(31) 99876-5432' → '31998765432').
 * Vazio/ausente (ou sem nenhum dígito) vira null — é o valor gravado em
 * crm_contatos.telefone_normalizado e usado no dedup de contato.
 */
export function normalizarTelefone(v?: string | null): string | null {
  if (!v) return null
  const digitos = v.replace(/\D/g, '')
  return digitos.length > 0 ? digitos : null
}

/**
 * Hash de deduplicação do lead: sha256 hex (64 chars) de `fonte|identidade|dia`.
 * A identidade é o email em minúsculas (case-insensitive) ou, na falta dele,
 * o telefone normalizado. `dia` em 'YYYY-MM-DD' (Brasília) — o MESMO lead da
 * MESMA fonte no MESMO dia colide de propósito (idempotência do inbox);
 * no dia seguinte é um lead novo.
 */
export function dedupHash(
  fonte: string,
  email: string | null | undefined,
  telefoneNormalizado: string | null | undefined,
  dia: string
): string {
  const identidade = email?.trim().toLowerCase() || telefoneNormalizado || ''
  return createHash('sha256').update(`${fonte}|${identidade}|${dia}`).digest('hex')
}
