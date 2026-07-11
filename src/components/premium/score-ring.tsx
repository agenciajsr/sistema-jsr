import { cn } from '@/lib/utils'

type ScoreRingProps = {
  /** Pontuação de 0 a 100. */
  score: number
  /** Diâmetro do anel em px. */
  size?: number
  /** Espessura do traço em px. */
  strokeWidth?: number
  /** Rótulo abaixo do número (ex.: "Saúde da Agência"). */
  label?: string
  /** Texto auxiliar menor abaixo do rótulo. */
  sublabel?: string
  className?: string
}

// Gradiente suave escolhido pela faixa da pontuação — verde para saúde alta,
// azul da marca no meio, âmbar/vermelho para saúde baixa. Sempre discreto.
function coresPorScore(score: number): [string, string] {
  if (score >= 75) return ['#2a86d6', '#16a34a']
  if (score >= 50) return ['#2a86d6', '#1e76c4']
  return ['#d97706', '#dc2626']
}

/**
 * Anel de progresso SVG (0-100) com gradiente suave. Componente sem estado
 * (pode rodar como server component). O arco começa no topo (rotação -90deg).
 */
export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 12,
  label,
  sublabel,
  className,
}: ScoreRingProps) {
  const valor = Math.max(0, Math.min(100, score))
  const raio = (size - strokeWidth) / 2
  const circunferencia = 2 * Math.PI * raio
  const offset = circunferencia * (1 - valor / 100)
  const [corInicio, corFim] = coresPorScore(valor)
  // Id determinístico e único o suficiente para múltiplos anéis na mesma tela.
  const gradId = `score-ring-${Math.round(valor)}-${size}-${strokeWidth}`

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`Pontuação ${valor} de 100${label ? ` — ${label}` : ''}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={corInicio} />
            <stop offset="100%" stopColor={corFim} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          {valor}
        </span>
        {label && (
          <span className="mt-0.5 text-xs font-medium text-muted-foreground">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-[11px] text-muted-foreground/80">{sublabel}</span>
        )}
      </div>
    </div>
  )
}
