'use client'

import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from 'recharts'

type SparklineProps = {
  data: number[]
  /** Cor do traço (aceita var(--token) ou hex). */
  cor: string
  tipo?: 'line' | 'area'
}

// Mini-gráfico sem eixos/grid/tooltip, para dentro dos KpiCards.
export function Sparkline({ data, cor, tipo = 'line' }: SparklineProps) {
  const dados = data.map((valor, i) => ({ i, valor }))
  const gradId = `spark-${cor.replace(/[^a-z0-9]/gi, '')}`

  return (
    <ResponsiveContainer width="100%" height={40}>
      {tipo === 'area' ? (
        <AreaChart data={dados} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="valor"
            stroke={cor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      ) : (
        <LineChart data={dados} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="valor"
            stroke={cor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}
