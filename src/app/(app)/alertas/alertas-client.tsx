'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  CheckCircle,
  UserX,
  Wallet,
  AlertTriangle,
  Info,
  DollarSign,
  TrendingDown,
  Target,
  MousePointerClick,
  Ban,
  ImageOff,
  Repeat,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Alerta, TipoAlerta, SeveridadeAlerta } from '@/lib/alertas/types'

// --- Constantes de UI ---

const TIPO_ICON: Record<TipoAlerta, React.ComponentType<{ className?: string }>> = {
  contrato_vencendo: Calendar,
  pagamento_vencido: Wallet,
  cliente_inativo: UserX,
  verba_baixa: DollarSign,
  cpa_alto: Target,
  performance_caindo: TrendingDown,
  ctr_caindo: MousePointerClick,
  sem_conversao: Ban,
  criativo_rejeitado: ImageOff,
  fadiga_criativo: Repeat,
}

const TIPO_LABEL: Record<TipoAlerta, string> = {
  contrato_vencendo: 'Contrato',
  pagamento_vencido: 'Pagamento',
  cliente_inativo: 'Cliente',
  verba_baixa: 'Verba',
  cpa_alto: 'Custo',
  performance_caindo: 'Performance',
  ctr_caindo: 'CTR',
  sem_conversao: 'Sem conversao',
  criativo_rejeitado: 'Criativo',
  fadiga_criativo: 'Fadiga',
}

const SEVERIDADE_CONFIG: Record<
  SeveridadeAlerta,
  { badgeClass: string; iconBgClass: string; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  critico: {
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
    iconBgClass: 'bg-destructive/10 text-destructive',
    label: 'Critico',
    icon: AlertTriangle,
  },
  atencao: {
    badgeClass: 'border-chart-warning/30 bg-chart-warning/10 text-chart-warning',
    iconBgClass: 'bg-chart-warning/10 text-chart-warning',
    label: 'Atencao',
    icon: AlertTriangle,
  },
  info: {
    badgeClass: 'border-primary/30 bg-primary/10 text-primary',
    iconBgClass: 'bg-primary/10 text-primary',
    label: 'Info',
    icon: Info,
  },
}

// --- localStorage helpers ---

const STORAGE_KEY = 'jsr-alertas-dispensados'

interface DismissedEntry {
  /** Chave unica do alerta (= alerta.id) */
  key: string
  /** Detalhe do alerta no momento do dismiss — se mudar, o alerta reaparece */
  detalhe: string
  /** Timestamp de quando foi dispensado */
  dismissedAt: number
}

function getDismissedMap(): Map<string, DismissedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const entries: DismissedEntry[] = JSON.parse(raw)
    return new Map(entries.map((e) => [e.key, e]))
  } catch {
    return new Map()
  }
}

function saveDismissedMap(map: Map<string, DismissedEntry>) {
  const entries = Array.from(map.values())
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function isAlertDismissed(alerta: Alerta, map: Map<string, DismissedEntry>): boolean {
  const entry = map.get(alerta.id)
  if (!entry) return false
  // Se o detalhe mudou (ex.: saldo diferente, dias diferentes), o alerta reaparece
  return entry.detalhe === alerta.detalhe
}

// --- Componente ---

interface AlertasClientProps {
  alertas: Alerta[]
}

export function AlertasClient({ alertas }: AlertasClientProps) {
  const [dismissedMap, setDismissedMap] = useState<Map<string, DismissedEntry>>(new Map())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDismissedMap(getDismissedMap())
    setMounted(true)
  }, [])

  const dismissAlert = useCallback((alerta: Alerta) => {
    setDismissedMap((prev) => {
      const next = new Map(prev)
      next.set(alerta.id, {
        key: alerta.id,
        detalhe: alerta.detalhe,
        dismissedAt: Date.now(),
      })
      saveDismissedMap(next)
      return next
    })
  }, [])

  // Antes de montar, mostra todos (evita flash de "nenhum alerta")
  const alertasVisiveis = mounted
    ? alertas.filter((a) => !isAlertDismissed(a, dismissedMap))
    : alertas

  const totalDismissed = mounted
    ? alertas.length - alertasVisiveis.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="text-sm text-muted-foreground">
          Tudo que precisa de atencao, em um so lugar.
        </p>
      </div>

      {alertasVisiveis.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="size-6" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum alerta no momento — tudo em ordem.
            </p>
            {totalDismissed > 0 && (
              <p className="text-xs text-muted-foreground">
                {totalDismissed} alerta{totalDismissed > 1 ? 's' : ''} dispensado{totalDismissed > 1 ? 's' : ''}.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {totalDismissed > 0 && (
            <p className="text-xs text-muted-foreground">
              {totalDismissed} alerta{totalDismissed > 1 ? 's' : ''} dispensado{totalDismissed > 1 ? 's' : ''}.
            </p>
          )}
          <div className="space-y-3">
            <TooltipProvider>
              {alertasVisiveis.map((alerta) => {
                const Icon = TIPO_ICON[alerta.tipo]
                const sevConfig = SEVERIDADE_CONFIG[alerta.severidade]
                return (
                  <Card key={alerta.id} className="border-none shadow-sm">
                    <CardContent className="flex items-start justify-between gap-4 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex size-9 items-center justify-center rounded-lg ${sevConfig.iconBgClass}`}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{alerta.titulo}</p>
                            <Badge variant="outline">{TIPO_LABEL[alerta.tipo]}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {alerta.clienteNome} &middot; {alerta.detalhe}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {alerta.dataRelevante}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`gap-1 ${sevConfig.badgeClass}`}
                        >
                          <sevConfig.icon className="size-3" />
                          {sevConfig.label}
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => dismissAlert(alerta)}
                            >
                              <X className="size-3.5" />
                              <span className="sr-only">Dispensar alerta</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Dispensar</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TooltipProvider>
          </div>
        </>
      )}
    </div>
  )
}
