// Dados de exemplo para telas ainda não conectadas a integrações reais
// (Meta Ads / Google Ads — Fase 2, alertas — Fase 3/4, relatórios — Fase 5).
// Servem apenas para visualizar o design completo do sistema antes da
// implementação funcional de cada fase.

export type ClienteTrafego = {
  id: string
  nome: string
  nicho: 'E-commerce' | 'Negócio Local' | 'Infoproduto'
  contaStatus: 'ativa' | 'atencao' | 'problema'
  contas: number
  verbaGasta: number
  verbaTotal: number
  ultimaSync: string
  campanhas: {
    nome: string
    plataforma: 'Meta Ads' | 'Google Ads'
    status: 'ativa' | 'pausada'
    gasto: number
    resultado: number
  }[]
}

export const clientesTrafegoMock: ClienteTrafego[] = [
  {
    id: '1',
    nome: 'Clínica Vitalis',
    nicho: 'Negócio Local',
    contaStatus: 'ativa',
    contas: 2,
    verbaGasta: 2140,
    verbaTotal: 3000,
    ultimaSync: 'há 12 min',
    campanhas: [
      { nome: 'Leads — Consulta Avaliação', plataforma: 'Meta Ads', status: 'ativa', gasto: 1240, resultado: 38 },
      { nome: 'Pesquisa — Clínica + Bairro', plataforma: 'Google Ads', status: 'ativa', gasto: 900, resultado: 21 },
    ],
  },
  {
    id: '2',
    nome: 'Loja Aurora Moda',
    nicho: 'E-commerce',
    contaStatus: 'problema',
    contas: 2,
    verbaGasta: 4820,
    verbaTotal: 5000,
    ultimaSync: 'há 3 horas',
    campanhas: [
      { nome: 'Advantage+ Catálogo', plataforma: 'Meta Ads', status: 'ativa', gasto: 3100, resultado: 4.2 },
      { nome: 'Shopping — Coleção Verão', plataforma: 'Google Ads', status: 'pausada', gasto: 1720, resultado: 2.8 },
    ],
  },
  {
    id: '3',
    nome: 'Método Cresce+',
    nicho: 'Infoproduto',
    contaStatus: 'atencao',
    contas: 1,
    verbaGasta: 1580,
    verbaTotal: 2500,
    ultimaSync: 'há 40 min',
    campanhas: [
      { nome: 'Webinar — Captação de Leads', plataforma: 'Meta Ads', status: 'ativa', gasto: 1580, resultado: 312 },
    ],
  },
]

// Verba investida por dia (soma das contas de anúncio) nos últimos 7 dias —
// alimenta o gráfico de barras do Painel.
export const verbaDiariaMock = [
  { dia: 'Qui', valor: 980 },
  { dia: 'Sex', valor: 1120 },
  { dia: 'Sáb', valor: 640 },
  { dia: 'Dom', valor: 590 },
  { dia: 'Seg', valor: 1340 },
  { dia: 'Ter', valor: 1210 },
  { dia: 'Qua', valor: 1080 },
]

export type AlertaMock = {
  id: string
  tipo: 'verba' | 'contrato' | 'performance'
  severidade: 'critico' | 'atencao'
  titulo: string
  cliente: string
  detalhe: string
  quando: string
}

export const alertasMock: AlertaMock[] = [
  {
    id: 'a1',
    tipo: 'verba',
    severidade: 'critico',
    titulo: 'Verba quase esgotada',
    cliente: 'Loja Aurora Moda',
    detalhe: '96% da verba mensal já consumida (R$ 4.820 de R$ 5.000)',
    quando: 'há 3 horas',
  },
  {
    id: 'a2',
    tipo: 'contrato',
    severidade: 'atencao',
    titulo: 'Contrato próximo do vencimento',
    cliente: 'Clínica Vitalis',
    detalhe: 'Vence em 12 dias — MRR em risco: R$ 1.800,00',
    quando: 'há 1 dia',
  },
  {
    id: 'a3',
    tipo: 'performance',
    severidade: 'atencao',
    titulo: 'Queda de performance',
    cliente: 'Método Cresce+',
    detalhe: 'Custo por lead subiu 34% em relação à semana anterior',
    quando: 'há 6 horas',
  },
]

export type FinanceiroClienteMock = {
  cliente: string
  mrr: number
  diaCobranca: number
  status: 'em dia' | 'próximo'
}

export const financeiroMock: FinanceiroClienteMock[] = [
  { cliente: 'Clínica Vitalis', mrr: 1800, diaCobranca: 5, status: 'próximo' },
  { cliente: 'Loja Aurora Moda', mrr: 3200, diaCobranca: 10, status: 'em dia' },
  { cliente: 'Método Cresce+', mrr: 2100, diaCobranca: 18, status: 'em dia' },
]

export type RelatorioMock = {
  cliente: string
  periodo: string
  status: 'gerado' | 'pendente'
  geradoEm: string | null
}

export const relatoriosMock: RelatorioMock[] = [
  { cliente: 'Clínica Vitalis', periodo: '30/06 – 06/07', status: 'gerado', geradoEm: '07/07/2026' },
  { cliente: 'Loja Aurora Moda', periodo: '30/06 – 06/07', status: 'gerado', geradoEm: '07/07/2026' },
  { cliente: 'Método Cresce+', periodo: '30/06 – 06/07', status: 'pendente', geradoEm: null },
]

export const mrrHistoricoMock = [
  { mes: 'Fev', mrr: 5200 },
  { mes: 'Mar', mrr: 5800 },
  { mes: 'Abr', mrr: 6100 },
  { mes: 'Mai', mrr: 6400 },
  { mes: 'Jun', mrr: 6900 },
  { mes: 'Jul', mrr: 7100 },
]

// Saúde geral da agência — número-assinatura do Painel (Mission Control).
// Score plausível derivado no espírito de: contas ok vs. alertas vs. MRR
// (3 clientes, 1 com conta em problema, 3 alertas ativos) → ~78.
export type AgencyHealthMock = {
  score: number
  clientesAtivos: number
  clientesEmRisco: number
}

export const agencyHealthMock: AgencyHealthMock = {
  score: 78,
  clientesAtivos: 3,
  clientesEmRisco: 1,
}

// Insights da IA (placeholder mock) — análise + sugestão de ação, no espírito
// do brief. Usa os mesmos clientes dos demais mocks para manter consistência.
export type InsightIaMock = {
  titulo: string
  texto: string
}

export const insightsIaMock: InsightIaMock[] = [
  {
    titulo: 'Loja Aurora Moda: verba prestes a esgotar',
    texto:
      'Gastou 96% da verba mensal (R$ 4.820 de R$ 5.000) faltando ainda 8 dias no ciclo. Sugiro redistribuir cerca de R$ 300/dia ou pausar a campanha Advantage+ Catálogo para não estourar o orçamento antes do fim do mês.',
  },
  {
    titulo: 'Método Cresce+: custo por lead subindo',
    texto:
      'O custo por lead do Webinar cresceu 34% frente à semana anterior. Vale revisar a criação/segmentação ou testar um novo público antes que a captação fique cara demais.',
  },
  {
    titulo: 'Clínica Vitalis: contrato a renovar',
    texto:
      'Contrato vence em 12 dias, com R$ 1.800 de MRR em risco. Sugiro agendar a conversa de renovação esta semana, aproveitando os 38 leads gerados na campanha de avaliação.',
  },
]
