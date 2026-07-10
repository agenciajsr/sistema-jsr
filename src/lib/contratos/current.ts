// CLI-04: derivação do contrato vigente a partir de uma lista de contratos.
// Deliberadamente NÃO usa uma flag `is_current` armazenada no banco — o contrato
// vigente é sempre derivado pela dataInicio mais recente, evitando o drift
// documentado em 01-RESEARCH.md (seção "Anti-Patterns to Avoid").

export type ContratoRow = {
  id: string
  clienteId: string
  dataInicio: string
  dataVencimento: string
  valorMensal: string
}

export function selecionarContratoAtual(contratos: ContratoRow[]): ContratoRow | null {
  if (contratos.length === 0) return null
  return [...contratos].sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))[0]
}
