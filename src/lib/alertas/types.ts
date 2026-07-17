export type TipoAlerta =
  | 'contrato_vencendo'
  | 'pagamento_vencido'
  | 'cliente_inativo'
  | 'verba_baixa'
  | 'cpa_alto'
  | 'performance_caindo'
  | 'ctr_caindo'
  | 'sem_conversao'
  | 'criativo_rejeitado'
  | 'fadiga_criativo'
  // Regras diárias por campanha/anúncio/conta (Feature 2, 17/jul/2026)
  | 'gasto_sem_resultado'
  | 'custo_acima_meta'
  | 'ctr_baixo'
  | 'gasto_disparado'
  | 'entrega_parada'
  | 'conta_com_problema'
  // Alertas operacionais internos (quick-260717-qq6): régua de inadimplência
  // sobre `cobrancas`, contrato parado em assinatura e SLA de 1º contato do CRM.
  | 'fatura_vencendo'
  | 'fatura_vencida'
  | 'assinatura_pendente'
  | 'sla_primeiro_contato'

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

// --- Alertas persistidos (tabela alertas) ---

export type StatusAlerta = 'novo' | 'lido' | 'resolvido'

/** Alerta como vive no banco: o shape de Alerta + metadados de triagem. */
export interface AlertaPersistido extends Alerta {
  dbId: string            // uuid da linha (para as ações de status)
  status: StatusAlerta
  detectadoEm: string     // ISO
  resolvidoEm: string | null
  silenciadoAte: string | null // ISO — "Silenciar 7 dias" (null = não silenciado)
}
