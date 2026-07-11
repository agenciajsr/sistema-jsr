import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardColor = 'primary' | 'success' | 'warning' | 'danger'

const COLOR_CLASSES: Record<StatCardColor, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-chart-success/10 text-chart-success',
  warning: 'bg-chart-warning/10 text-chart-warning',
  danger: 'bg-destructive/10 text-destructive',
}

type StatCardProps = {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color?: StatCardColor
  trend?: { value: string; direction: 'up' | 'down'; positive?: boolean }
  helper?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'primary',
  trend,
  helper,
}: StatCardProps) {
  return (
    <Card className="gap-2 border-none p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-lg',
            COLOR_CLASSES[color],
          )}
        >
          <Icon className="size-4.5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend.positive ?? trend.direction === 'up'
                ? 'text-chart-success'
                : 'text-destructive',
            )}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </Card>
  )
}
