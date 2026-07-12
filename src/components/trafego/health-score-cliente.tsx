import { cn } from '@/lib/utils'

type HealthScoreClienteProps = {
  score: number
  rotulo: string
}

// Cor por faixa de saúde: verde (>=80), âmbar (>=50), vermelho (<50).
function classesPorScore(score: number): string {
  if (score >= 80) return 'bg-chart-success/10 text-chart-success border-chart-success/30'
  if (score >= 50) return 'bg-chart-warning/10 text-chart-warning border-chart-warning/30'
  return 'bg-destructive/10 text-destructive border-destructive/30'
}

/**
 * Indicador compacto de health score do cliente (0-100 + rótulo).
 * Sem estado — pode rodar como server component.
 */
export function HealthScoreCliente({ score, rotulo }: HealthScoreClienteProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1',
        classesPorScore(score),
      )}
    >
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <span className="text-xs font-medium">Saúde: {rotulo}</span>
    </div>
  )
}
