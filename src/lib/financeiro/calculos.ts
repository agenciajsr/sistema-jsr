/**
 * Matematica pura do modulo financeiro — fonte unica dos calculos consumidos
 * pelas Server Actions e pela UI. Sem import de db/auth/react de proposito:
 * assim tudo aqui e testavel sem banco e sem ambiente de React.
 *
 * Regra geral: percentuais sao arredondados em 2 casas; valores em reais passam
 * intactos (a UI formata). Toda divisao por zero devolve null ou um default
 * explicito — nunca Infinity/NaN.
 */

export type Faixa = 'saudavel' | 'atencao' | 'critico'

/** Arredonda em 2 casas decimais. */
function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Variacao % de `atual` sobre `anterior`.
 * null quando anterior === 0 (base inexistente => variacao indefinida, NAO infinito).
 */
export function calcularVariacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return arredondar2(((atual - anterior) / anterior) * 100)
}

/**
 * percentual = despesa / receita * 100. null quando receita === 0 (UI mostra
 * "Sem receita no periodo"). Faixas: <60 saudavel, 60-80 atencao, >=80 critico.
 */
export function calcularDespesasVsFaturamento(
  despesa: number,
  receita: number,
): { percentual: number | null; faixa: Faixa | null; despesa: number; receita: number } {
  if (receita === 0) {
    return { percentual: null, faixa: null, despesa, receita }
  }

  const percentual = arredondar2((despesa / receita) * 100)
  const faixa: Faixa = percentual >= 80 ? 'critico' : percentual >= 60 ? 'atencao' : 'saudavel'

  return { percentual, faixa, despesa, receita }
}

/**
 * Um contrato vencido conta como renovado se existe contrato do MESMO cliente
 * com dataInicio > aquele dataVencimento. Datas 'YYYY-MM-DD' comparam
 * corretamente como string (ISO lexicografico) — nao criar Date (evita fuso).
 */
export function contarRenovados(
  vencidos: { clienteId: string; dataVencimento: string }[],
  contratosDoCliente: { clienteId: string; dataInicio: string }[],
): number {
  if (vencidos.length === 0) return 0

  const iniciosPorCliente = new Map<string, string[]>()
  for (const c of contratosDoCliente) {
    const lista = iniciosPorCliente.get(c.clienteId)
    if (lista) lista.push(c.dataInicio)
    else iniciosPorCliente.set(c.clienteId, [c.dataInicio])
  }

  return vencidos.filter((v) => {
    const inicios = iniciosPorCliente.get(v.clienteId)
    return inicios ? inicios.some((inicio) => inicio > v.dataVencimento) : false
  }).length
}

/** percentual 100 quando total === 0 (nenhum contrato vencia no mes => nada foi perdido). */
export function calcularTaxaRenovacao(
  renovados: number,
  total: number,
): { renovados: number; total: number; percentual: number } {
  if (total === 0) return { renovados: 0, total: 0, percentual: 100 }
  return { renovados, total, percentual: arredondar2((renovados / total) * 100) }
}

/** 0 quando qtdClientes === 0. */
export function calcularLucroPorCliente(lucro: number, qtdClientes: number): number {
  if (qtdClientes === 0) return 0
  return lucro / qtdClientes
}

/**
 * Concentracao do MRR: quanto do faturamento recorrente depende dos maiores
 * clientes. Ordena desc, corta o top 10 e calcula os percentuais top5/top10.
 */
export function calcularDependencia(linhas: { nome: string; valor: number }[]): {
  mrrTotal: number
  topClientes: { nome: string; valor: number; percentual: number }[]
  percentTop5: number
  percentTop10: number
} {
  const mrrTotal = linhas.reduce((soma, l) => soma + l.valor, 0)

  if (linhas.length === 0 || mrrTotal === 0) {
    return { mrrTotal, topClientes: [], percentTop5: 0, percentTop10: 0 }
  }

  const ordenadas = [...linhas].sort((a, b) => b.valor - a.valor)
  const somar = (lista: { valor: number }[]) => lista.reduce((s, l) => s + l.valor, 0)

  const topClientes = ordenadas.slice(0, 10).map((l) => ({
    nome: l.nome,
    valor: l.valor,
    percentual: arredondar2((l.valor / mrrTotal) * 100),
  }))

  return {
    mrrTotal,
    topClientes,
    percentTop5: arredondar2((somar(ordenadas.slice(0, 5)) / mrrTotal) * 100),
    percentTop10: arredondar2((somar(ordenadas.slice(0, 10)) / mrrTotal) * 100),
  }
}

/** Bordas do mes anterior a (mes, ano). Vira o ano em janeiro e respeita bissexto. */
export function periodoMesAnterior(
  mes: number,
  ano: number,
): { mes: number; ano: number; primeiroDia: string; ultimoDia: string } {
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano

  // Date.UTC e 0-indexado no mes: dia 0 do mes `mesAnt` (0-indexado = mes
  // seguinte ao anterior) = ultimo dia do mes anterior. Ancorado em UTC.
  const ultimoDia = new Date(Date.UTC(anoAnt, mesAnt, 0)).toISOString().slice(0, 10)

  return {
    mes: mesAnt,
    ano: anoAnt,
    primeiroDia: `${anoAnt}-${String(mesAnt).padStart(2, '0')}-01`,
    ultimoDia,
  }
}

/** Progresso do mes a partir de uma data 'YYYY-MM-DD' (ja no fuso desejado). */
export function progressoDoMes(hojeISO: string): {
  dia: number
  diasNoMes: number
  percentual: number
} {
  // Parse por split — `new Date(hojeISO)` sem ancora sofre drift de fuso.
  const [ano, mes, dia] = hojeISO.split('-').map(Number)
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()

  return { dia, diasNoMes, percentual: Math.round((dia / diasNoMes) * 100) }
}
