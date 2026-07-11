// Dados de exemplo para as áreas adicionadas ao escopo em 2026-07-10
// (Contratos, Checklist, Acompanhamento, Verbas Ads, Funil — ver
// .planning/REQUIREMENTS.md § Contratos/Checklist/Acompanhamento/Verbas
// Ads/Funil). Nenhuma dessas telas está conectada a dados reais ainda.

export type ContratoMock = {
  id: string
  cliente: string
  dataInicio: string
  dataVencimento: string
  valorMensal: number
  status: 'atual' | 'encerrado'
}

export const contratosMock: ContratoMock[] = [
  { id: 'c1', cliente: 'Clínica Vitalis', dataInicio: '2026-01-05', dataVencimento: '2026-07-22', valorMensal: 1800, status: 'atual' },
  { id: 'c2', cliente: 'Loja Aurora Moda', dataInicio: '2026-03-10', dataVencimento: '2026-09-10', valorMensal: 3200, status: 'atual' },
  { id: 'c3', cliente: 'Método Cresce+', dataInicio: '2026-04-18', dataVencimento: '2026-10-18', valorMensal: 2100, status: 'atual' },
  { id: 'c4', cliente: 'Clínica Vitalis', dataInicio: '2025-07-05', dataVencimento: '2026-01-05', valorMensal: 1600, status: 'encerrado' },
]

export type ChecklistItemMock = {
  id: string
  cliente: string
  tarefa: string
  frequencia: 'diária' | 'semanal' | 'mensal'
  feito: boolean
}

export const checklistMock: ChecklistItemMock[] = [
  { id: 'ck1', cliente: 'Clínica Vitalis', tarefa: 'Conferir verba disponível', frequencia: 'diária', feito: true },
  { id: 'ck2', cliente: 'Clínica Vitalis', tarefa: 'Revisar criativos em teste', frequencia: 'semanal', feito: false },
  { id: 'ck3', cliente: 'Loja Aurora Moda', tarefa: 'Conferir verba disponível', frequencia: 'diária', feito: true },
  { id: 'ck4', cliente: 'Loja Aurora Moda', tarefa: 'Atualizar catálogo de produtos', frequencia: 'semanal', feito: false },
  { id: 'ck5', cliente: 'Método Cresce+', tarefa: 'Enviar relatório mensal', frequencia: 'mensal', feito: false },
]

export type AcompanhamentoMock = {
  id: string
  cliente: string
  data: string
  autor: string
  nota: string
}

export const acompanhamentoMock: AcompanhamentoMock[] = [
  { id: 'ac1', cliente: 'Clínica Vitalis', data: '08/07/2026', autor: 'Jacson', nota: 'Cliente pediu para priorizar campanha de avaliação estética no próximo mês.' },
  { id: 'ac2', cliente: 'Loja Aurora Moda', data: '05/07/2026', autor: 'Jacson', nota: 'Reunião de alinhamento — aprovou aumento de verba para a Black Friday.' },
  { id: 'ac3', cliente: 'Método Cresce+', data: '01/07/2026', autor: 'Jacson', nota: 'Cliente sinalizou possível churn se CPL não melhorar até agosto.' },
]

export type VerbaAdsMock = {
  cliente: string
  plataforma: 'Meta Ads' | 'Google Ads'
  verbaMensal: number
  gastoAtual: number
  ajusteSugerido: 'manter' | 'aumentar' | 'reduzir'
}

export const verbasAdsMock: VerbaAdsMock[] = [
  { cliente: 'Clínica Vitalis', plataforma: 'Meta Ads', verbaMensal: 3000, gastoAtual: 2140, ajusteSugerido: 'manter' },
  { cliente: 'Loja Aurora Moda', plataforma: 'Meta Ads', verbaMensal: 5000, gastoAtual: 4820, ajusteSugerido: 'aumentar' },
  { cliente: 'Método Cresce+', plataforma: 'Meta Ads', verbaMensal: 2500, gastoAtual: 1580, ajusteSugerido: 'reduzir' },
]

export type FunilEtapaMock = {
  etapa: string
  quantidade: number
}

export const funilMock: FunilEtapaMock[] = [
  { etapa: 'Contato Inicial', quantidade: 8 },
  { etapa: 'Reunião Agendada', quantidade: 5 },
  { etapa: 'Proposta Enviada', quantidade: 3 },
  { etapa: 'Fechado', quantidade: 1 },
]
