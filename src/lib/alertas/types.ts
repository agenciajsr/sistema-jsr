export type TipoAlerta =
  | 'contrato_vencendo'
  | 'pagamento_vencido'
  | 'cliente_inativo'
  | 'verba_baixa'
  | 'cpa_alto'
  | 'performance_caindo'
  | 'ctr_caindo'
  | 'sem_conversao'

export type SeveridadeAlerta = 'critico' | 'atencao' | 'info'

export interface Alerta {
  id: string
  tipo: TipoAlerta
  severidade: SeveridadeAlerta
  titulo: string
  detalhe: string
  clienteNome: string
  clienteId: string
  dataRelevante: string
}

export const SEVERIDADE_ORDEM: Record<SeveridadeAlerta, number> = {
  critico: 0,
  atencao: 1,
  info: 2,
}
