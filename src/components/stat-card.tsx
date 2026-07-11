import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardColor = 'primary' | 'success' | 'warning' | 'danger'

const COLOR_CLASSES: Record<StatCardColor, string> = {
  primary: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/15',
  success: 'bg-chart-success/10 text-chart-success ring-1 ring-inset ring-chart-success/15',
  warning: 'bg-chart-warning/10 text-chart-warning ring-1 ring-inset ring-chart-warning/15',
  danger: 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15',
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
    <Card className="gap-2.5 border-none p-6 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            COLOR_CLASSES[color],
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight">{value}</span>
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
