// CLI-02, CLI-03: construção do registro de uma renovação de contrato.
// D-06: toda renovação cria um NOVO registro — nunca edita o registro anterior.
// O tipo NovoContratoRecord não inclui 'id', tornando estruturalmente impossível
// o chamador usar este resultado em um db.update em vez de um db.insert.
// Este arquivo não importa de @/lib/validations/contrato para não criar dependência
// cruzada com o Plan 01-04 — recebe os dados já validados como tipo local.

export type DadosRenovacao = {
  dataInicio: string
  dataVencimento: string
  valorMensal: number
}

export type NovoContratoRecord = {
  clienteId: string
  dataInicio: string
  dataVencimento: string
  valorMensal: string
}

export function construirRegistroRenovacao(
  clienteId: string,
  dados: DadosRenovacao
): NovoContratoRecord {
  return {
    clienteId,
    dataInicio: dados.dataInicio,
    dataVencimento: dados.dataVencimento,
    valorMensal: String(dados.valorMensal),
  }
}
