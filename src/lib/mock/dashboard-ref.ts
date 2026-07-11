// Dados de exemplo do Dashboard de referência (quick-260711-f7m).
// Reproduz fielmente os números da imagem aprovada por Jacson como padrão
// visual definitivo. NÃO conectado a integrações reais — substituir pelos
// dados de Meta/Google Ads (Fase 2) e financeiro quando disponíveis.
//
// Convenção: guardamos números crus (para reformatar/reusar) e strings apenas
// quando são rótulos fixos. A formatação pt-BR é aplicada no consumo.

export type Tendencia = { valor: string; direcao: 'up' | 'down' }

export type KpiCor = 'info' | 'success' | 'purple' | 'orange' | 'whatsapp'

export type Kpi = {
  id: string
  label: string
  valor: string
  cor: KpiCor
  tendencia?: Tendencia
  helper?: string
  serie?: number[]
  progresso?: number
}

// 6 KPIs da faixa superior — valores EXATOS da referência.
export const kpisMock: Kpi[] = [
  {
    id: 'faturamento',
    label: 'Faturamento (MRR)',
    valor: 'R$ 34.500,00',
    cor: 'info',
    tendencia: { valor: '14,6%', direcao: 'up' },
    helper: 'vs mês passado',
    serie: [24, 26, 25, 28, 30, 29, 32, 31, 33, 34.5],
  },
  {
    id: 'recebimentos',
    label: 'Recebimentos (Mês)',
    valor: 'R$ 29.100,00',
    cor: 'success',
    helper: '84% do previsto',
    progresso: 84,
  },
  {
    id: 'lucro',
    label: 'Lucro Líquido (Mês)',
    valor: 'R$ 21.650,00',
    cor: 'purple',
    tendencia: { valor: '18,7%', direcao: 'up' },
    helper: 'vs mês passado',
    serie: [14, 15, 16, 15.5, 17, 18, 19, 20, 21, 21.65],
  },
  {
    id: 'clientes',
    label: 'Clientes Ativos',
    valor: '18',
    cor: 'info',
    helper: '↑ 2 este mês',
  },
  {
    id: 'campanhas',
    label: 'Campanhas Ativas',
    valor: '43',
    cor: 'orange',
    helper: 'Em 12 clientes',
  },
  {
    id: 'conversas',
    label: 'Conversas (WhatsApp)',
    valor: '568',
    cor: 'whatsapp',
    tendencia: { valor: '27,4%', direcao: 'up' },
    helper: 'vs 7 dias',
    serie: [320, 360, 390, 410, 440, 480, 500, 520, 550, 568],
  },
]

export type MetricaTopo = {
  id: string
  label: string
  valor: string
  tendencia: Tendencia
}

export type MiniMetrica = {
  id: string
  label: string
  valor: string
  tendencia: Tendencia
}

export type PerformanceGeral = {
  clienteSelecionado: string
  metricas: MetricaTopo[]
  serie: { rotulo: string; valor: number }[]
  miniMetricas: MiniMetrica[]
}

export const performanceGeralMock: PerformanceGeral = {
  clienteSelecionado: 'Clínica Bella',
  metricas: [
    { id: 'investimento', label: 'Investimento', valor: 'R$ 12.450,00', tendencia: { valor: '8,2%', direcao: 'up' } },
    { id: 'conversas', label: 'Conversas', valor: '198', tendencia: { valor: '23%', direcao: 'up' } },
    { id: 'cpa', label: 'CPA', valor: 'R$ 62,88', tendencia: { valor: '11%', direcao: 'down' } },
    { id: 'roas', label: 'ROAS', valor: '4,32x', tendencia: { valor: '8,8%', direcao: 'up' } },
  ],
  serie: [
    { rotulo: '01/07', valor: 28000 },
    { rotulo: '02/07', valor: 31000 },
    { rotulo: '03/07', valor: 29500 },
    { rotulo: '04/07', valor: 35000 },
    { rotulo: '05/07', valor: 33000 },
    { rotulo: '06/07', valor: 38000 },
    { rotulo: '07/07', valor: 42000 },
    { rotulo: '08/07', valor: 40000 },
    { rotulo: '09/07', valor: 46000 },
    { rotulo: '10/07', valor: 49500 },
  ],
  miniMetricas: [
    { id: 'cliques', label: 'Cliques', valor: '1.245', tendencia: { valor: '15%', direcao: 'up' } },
    { id: 'ctr', label: 'CTR', valor: '2,45%', tendencia: { valor: '9%', direcao: 'up' } },
    { id: 'cpc', label: 'CPC', valor: 'R$ 0,45', tendencia: { valor: '6%', direcao: 'down' } },
    { id: 'impressoes', label: 'Impressões', valor: '50.760', tendencia: { valor: '12%', direcao: 'up' } },
    { id: 'frequencia', label: 'Frequência', valor: '2,18', tendencia: { valor: '4%', direcao: 'down' } },
  ],
}

export type NivelSaude = 'excelente' | 'boa' | 'atencao' | 'critica'

export type CampanhaSaude = {
  id: string
  nome: string
  campanhasAtivas: number
  score: number
  rotulo: string
  nivel: NivelSaude
}

export const campanhasSaudeMock: CampanhaSaude[] = [
  { id: 'clinica-bella', nome: 'Clínica Bella', campanhasAtivas: 8, score: 95, rotulo: 'Excelente', nivel: 'excelente' },
  { id: 'pizzaria-joao', nome: 'Pizzaria do João', campanhasAtivas: 5, score: 72, rotulo: 'Atenção', nivel: 'atencao' },
  { id: 'academia-evolution', nome: 'Academia Evolution', campanhasAtivas: 6, score: 38, rotulo: 'Crítica', nivel: 'critica' },
  { id: 'moda-feminina', nome: 'Moda Feminina Store', campanhasAtivas: 4, score: 88, rotulo: 'Boa', nivel: 'boa' },
]

export type CorAgenda = 'info' | 'success' | 'purple' | 'orange'

export type AgendaItem = {
  id: string
  horario: string
  titulo: string
  cliente: string
  cor: CorAgenda
}

export const agendaHojeMock: AgendaItem[] = [
  { id: 'a1', horario: '09:00', titulo: 'Revisão de campanhas', cliente: 'Clínica Bella', cor: 'info' },
  { id: 'a2', horario: '11:00', titulo: 'Call de alinhamento', cliente: 'Pizzaria do João', cor: 'success' },
  { id: 'a3', horario: '14:00', titulo: 'Entrega de relatório', cliente: 'Academia Evolution', cor: 'purple' },
  { id: 'a4', horario: '16:30', titulo: 'Reunião comercial', cliente: 'Novo projeto', cor: 'orange' },
]

export type ResumoFinanceiro = {
  receitas: { valor: string; percent: number; helper: string }
  despesas: { valor: string; percent: number; helper: string }
  lucro: { valor: string; tendencia: Tendencia; helper: string }
  serie: { rotulo: string; valor: number }[]
}

export const resumoFinanceiroMock: ResumoFinanceiro = {
  receitas: { valor: 'R$ 29.100,00', percent: 84, helper: '84% do previsto' },
  despesas: { valor: 'R$ 7.450,00', percent: 68, helper: '68% do previsto' },
  lucro: { valor: 'R$ 21.650,00', tendencia: { valor: '18,7%', direcao: 'up' }, helper: 'vs mês passado' },
  serie: [
    { rotulo: 'Jan', valor: 15200 },
    { rotulo: 'Fev', valor: 16800 },
    { rotulo: 'Mar', valor: 17500 },
    { rotulo: 'Abr', valor: 18900 },
    { rotulo: 'Mai', valor: 19600 },
    { rotulo: 'Jun', valor: 20400 },
    { rotulo: 'Jul', valor: 21650 },
  ],
}

export type SeveridadeAlerta = 'danger' | 'warning' | 'orange' | 'info'

export type AlertaImportante = {
  id: string
  texto: string
  link: string
  href: string
  cor: SeveridadeAlerta
}

export const alertasImportantesMock: AlertaImportante[] = [
  { id: 'al1', texto: '3 clientes com saldo de anúncios baixo', link: 'Ver clientes', href: '/clientes', cor: 'danger' },
  { id: 'al2', texto: '2 contratos vencem em 7 dias', link: 'Ver contratos', href: '/contratos', cor: 'warning' },
  { id: 'al3', texto: '1 campanha com CPA acima da meta', link: 'Ver campanhas', href: '/campanhas', cor: 'orange' },
  { id: 'al4', texto: '1 cliente com pagamento atrasado', link: 'Ver financeiro', href: '/financeiro', cor: 'info' },
]

export type TipoAtividade = 'relatorio' | 'pagamento' | 'campanha' | 'cliente'

export type Atividade = {
  id: string
  titulo: string
  sub: string
  tempo: string
  tipo: TipoAtividade
}

export const atividadeRecenteMock: Atividade[] = [
  { id: 'at1', titulo: 'Novo relatório gerado', sub: 'Clínica Bella - Relatório Semanal', tempo: 'Há 2h', tipo: 'relatorio' },
  { id: 'at2', titulo: 'Pagamento recebido', sub: 'Academia Evolution - R$ 2.500,00', tempo: 'Há 5h', tipo: 'pagamento' },
  { id: 'at3', titulo: 'Campanha pausada', sub: 'Moda Feminina Store - Tráfego Pago', tempo: 'Há 6h', tipo: 'campanha' },
  { id: 'at4', titulo: 'Novo cliente adicionado', sub: 'Construtora Valente', tempo: 'Há 1d', tipo: 'cliente' },
]

export type LinhaPerformanceCliente = {
  id: string
  cliente: string
  investimento: string
  conversas: number
  cpa: string
  roas: string
  vendas: number
  nivel: NivelSaude
  rotulo: string
}

export const performanceClienteMock: LinhaPerformanceCliente[] = [
  { id: 'pc1', cliente: 'Clínica Bella', investimento: 'R$ 2.450,00', conversas: 48, cpa: 'R$ 51,04', roas: '4,32x', vendas: 68, nivel: 'excelente', rotulo: 'Excelente' },
  { id: 'pc2', cliente: 'Pizzaria do João', investimento: 'R$ 1.850,00', conversas: 32, cpa: 'R$ 57,81', roas: '3,21x', vendas: 45, nivel: 'atencao', rotulo: 'Atenção' },
  { id: 'pc3', cliente: 'Academia Evolution', investimento: 'R$ 2.980,00', conversas: 18, cpa: 'R$ 165,55', roas: '2,18x', vendas: 28, nivel: 'critica', rotulo: 'Crítica' },
  { id: 'pc4', cliente: 'Moda Feminina Store', investimento: 'R$ 1.320,00', conversas: 26, cpa: 'R$ 50,77', roas: '4,12x', vendas: 34, nivel: 'boa', rotulo: 'Boa' },
]

export const aiInsightMock = {
  texto:
    'Notei que suas campanhas da Clínica Bella estão com CTR 32% acima da média do segmento. Ótimo trabalho! 🚀',
}

export const planoAtualMock = {
  nome: 'JSR PRO',
  vence: '24/08/2026',
  percentUtilizado: 75,
}

export const perfilMock = {
  nome: 'Jacson Ribeiro',
  cargo: 'Administrador',
}

export const contadoresHeaderMock = {
  notificacoes: 7,
  mensagens: 3,
}
