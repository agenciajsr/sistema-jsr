import { ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NivelSaude } from '@/lib/mock/dashboard-ref'

// Classes tonalizadas por nível de saúde — fundo suave + texto na cor do token.
const CLASSES_NIVEL: Record<NivelSaude, string> = {
  excelente: 'bg-chart-success/10 text-chart-success',
  boa: 'bg-chart-success/10 text-chart-success',
  atencao: 'bg-chart-warning/10 text-chart-warning',
  critica: 'bg-chart-danger/10 text-chart-danger',
}

type StatusBadgeProps = {
  nivel: NivelSaude
  rotulo: string
  /** Quando informado, exibe o número do score antes do rótulo. */
  score?: number
  /** Exibe a seta ascendente (padrão da referência para status positivos). */
  seta?: boolean
  className?: string
}

// Badge reutilizável de status/saúde. Server component.
export function StatusBadge({ nivel, rotulo, score, seta, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1 font-semibold', CLASSES_NIVEL[nivel], className)}
    >
      {typeof score === 'number' && <span className="tabular-nums">{score}</span>}
      <span>{rotulo}</span>
      {seta && <ArrowUpRight className="size-3" />}
    </Badge>
  )
}
