import { Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type AiInsight = {
  titulo: string
  texto: string
}

type AiInsightCardProps = {
  insights: AiInsight[]
  className?: string
}

/**
 * Card de "Insights da IA" — peça-assinatura que materializa a visão de IA como
 * protagonista. Por ora exibe insights mockados (selo IA deixa claro que é
 * placeholder até a análise real ser conectada).
 */
export function AiInsightCard({ insights, className }: AiInsightCardProps) {
  return (
    <Card
      className={cn(
        'animate-in fade-in-50 slide-in-from-bottom-1 bg-[image:var(--gradient-surface)] duration-500',
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Sparkles className="size-4" />
          </span>
          Insights da IA
          <Badge
            variant="secondary"
            className="ml-1 bg-primary/10 text-[10px] font-semibold uppercase tracking-wide text-primary"
          >
            IA
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-card/60 p-4"
          >
            <p className="text-sm font-medium">{insight.titulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {insight.texto}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
