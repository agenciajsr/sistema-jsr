// Matemática PURA do Dashboard Comercial (/funil): períodos, variações, taxas
// e merge dos agregados em estrutura pronta para a UI.
// Módulo puro: zero imports de db/auth/react (decisão 260714-ita).

export type PresetPeriodo = 'este-mes' | 'mes-passado' | 'ultimos-30' | 'este-ano'

export const PRESETS_PERIODO: PresetPeriodo[] = [
  'este-mes',
  'mes-passado',
  'ultimos-30',
  'este-ano',
]

export type Periodo = {
  inicio: string // YYYY-MM-DD (inclusive)
  fim: string
  inicioAnterior: string
  fimAnterior: string
}

// Datas tratadas como calendário puro (YYYY-MM-DD) em UTC — quem converte para
// o fuso de Brasília é a camada de dados, ao montar os timestamps do intervalo.
function deISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function paraISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function somarDias(iso: string, dias: number): string {
  const d = deISO(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraISO(d)
}

function ultimoDiaDoMes(ano: number, mesZero: number): number {
  return new Date(Date.UTC(ano, mesZero + 1, 0)).getUTCDate()
}

/**
 * Intervalos do período pedido + o período ANTERIOR de mesma duração:
 * este-mes → mesmo intervalo de dias do mês anterior (travado no último dia);
 * mes-passado → mês retrasado cheio; ultimos-30 → os 30 dias anteriores;
 * este-ano → ano passado até a mesma data.
 */
export function calcularPeriodo(preset: PresetPeriodo, hojeISO: string): Periodo {
  const hoje = deISO(hojeISO)
  const ano = hoje.getUTCFullYear()
  const mes = hoje.getUTCMonth()
  const dia = hoje.getUTCDate()

  if (preset === 'este-mes') {
    const anoAnt = mes === 0 ? ano - 1 : ano
    const mesAnt = mes === 0 ? 11 : mes - 1
    const diaAnt = Math.min(dia, ultimoDiaDoMes(anoAnt, mesAnt))
    return {
      inicio: paraISO(new Date(Date.UTC(ano, mes, 1))),
      fim: hojeISO,
      inicioAnterior: paraISO(new Date(Date.UTC(anoAnt, mesAnt, 1))),
      fimAnterior: paraISO(new Date(Date.UTC(anoAnt, mesAnt, diaAnt))),
    }
  }

  if (preset === 'mes-passado') {
    const anoAnt = mes === 0 ? ano - 1 : ano
    const mesAnt = mes === 0 ? 11 : mes - 1
    const anoRetra = mesAnt === 0 ? anoAnt - 1 : anoAnt
    const mesRetra = mesAnt === 0 ? 11 : mesAnt - 1
    return {
      inicio: paraISO(new Date(Date.UTC(anoAnt, mesAnt, 1))),
      fim: paraISO(new Date(Date.UTC(anoAnt, mesAnt, ultimoDiaDoMes(anoAnt, mesAnt)))),
      inicioAnterior: paraISO(new Date(Date.UTC(anoRetra, mesRetra, 1))),
      fimAnterior: paraISO(new Date(Date.UTC(anoRetra, mesRetra, ultimoDiaDoMes(anoRetra, mesRetra)))),
    }
  }

  if (preset === 'ultimos-30') {
    const inicio = somarDias(hojeISO, -29)
    return {
      inicio,
      fim: hojeISO,
      inicioAnterior: somarDias(inicio, -30),
      fimAnterior: somarDias(inicio, -1),
    }
  }

  // este-ano
  return {
    inicio: `${ano}-01-01`,
    fim: hojeISO,
    inicioAnterior: `${ano - 1}-01-01`,
    fimAnterior: paraISO(new Date(Date.UTC(ano - 1, mes, Math.min(dia, ultimoDiaDoMes(ano - 1, mes))))),
  }
}

/** Variação % vs período anterior. Base zero → null (UI mostra "—"). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/** Taxa de conversão em % — denominador zero vira 0, nunca NaN/Infinity. */
export function taxaConversao(numerador: number, denominador: number): number {
  if (denominador === 0) return 0
  return (numerador / denominador) * 100
}

export type AgregadoPeriodo = {
  criadas: number
  agendadas: number
  ganhas: number
  receita: number
  perdidas: number
}

export type InsumosDashboard = {
  atual: AgregadoPeriodo
  anterior: AgregadoPeriodo
  origens: { origem: string | null; total: number }[]
}

export type KpiComVariacao = { valor: number; variacao: number | null }

export type DashboardMontado = {
  kpis: {
    novosLeads: KpiComVariacao
    agendados: KpiComVariacao
    vendas: KpiComVariacao
    receitaTotal: KpiComVariacao
    leadsPerdidos: KpiComVariacao
  }
  funil: {
    novoLead: number
    agendado: number
    pagou: number
    taxaNovoAgendado: number
    taxaAgendadoPagou: number
  }
  performance: {
    conversaoTotal: KpiComVariacao // ganhas/criadas em %
    ticketMedio: KpiComVariacao // receita/ganhas em R$
    receitaPorLead: KpiComVariacao // receita/criadas em R$
  }
  origens: { origem: string; total: number; pct: number }[]
}

function divisaoSegura(numerador: number, denominador: number): number {
  return denominador === 0 ? 0 : numerador / denominador
}

/** Merge final: agregados crus dos dois períodos → estrutura pronta da página. */
export function montarDashboard(insumos: InsumosDashboard): DashboardMontado {
  const { atual, anterior, origens } = insumos

  const conversaoAtual = taxaConversao(atual.ganhas, atual.criadas)
  const conversaoAnterior = taxaConversao(anterior.ganhas, anterior.criadas)
  const ticketAtual = divisaoSegura(atual.receita, atual.ganhas)
  const ticketAnterior = divisaoSegura(anterior.receita, anterior.ganhas)
  const porLeadAtual = divisaoSegura(atual.receita, atual.criadas)
  const porLeadAnterior = divisaoSegura(anterior.receita, anterior.criadas)

  return {
    kpis: {
      novosLeads: { valor: atual.criadas, variacao: variacaoPercentual(atual.criadas, anterior.criadas) },
      agendados: { valor: atual.agendadas, variacao: variacaoPercentual(atual.agendadas, anterior.agendadas) },
      vendas: { valor: atual.ganhas, variacao: variacaoPercentual(atual.ganhas, anterior.ganhas) },
      receitaTotal: { valor: atual.receita, variacao: variacaoPercentual(atual.receita, anterior.receita) },
      leadsPerdidos: { valor: atual.perdidas, variacao: variacaoPercentual(atual.perdidas, anterior.perdidas) },
    },
    funil: {
      novoLead: atual.criadas,
      agendado: atual.agendadas,
      pagou: atual.ganhas,
      taxaNovoAgendado: taxaConversao(atual.agendadas, atual.criadas),
      taxaAgendadoPagou: taxaConversao(atual.ganhas, atual.agendadas),
    },
    performance: {
      conversaoTotal: { valor: conversaoAtual, variacao: variacaoPercentual(conversaoAtual, conversaoAnterior) },
      ticketMedio: { valor: ticketAtual, variacao: variacaoPercentual(ticketAtual, ticketAnterior) },
      receitaPorLead: { valor: porLeadAtual, variacao: variacaoPercentual(porLeadAtual, porLeadAnterior) },
    },
    origens: origens.map((o) => ({
      // origem null -> 'outro' (mesmo fallback de dados.ts)
      origem: o.origem ?? 'outro',
      total: o.total,
      pct: atual.criadas > 0 ? Math.round((o.total / atual.criadas) * 100) : 0,
    })),
  }
}
