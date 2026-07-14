'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Check,
  CheckCheck,
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
  RefreshCw,
  Loader2,
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
import {
  marcarAlertaComoLido,
  marcarTodosComoLidos,
  reavaliarAlertasAgora,
} from '@/actions/alertas'
import type { AlertaPersistido, StatusAlerta, TipoAlerta, SeveridadeAlerta } from '@/lib/alertas/types'

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

const ABAS: { valor: StatusAlerta; label: string }[] = [
  { valor: 'novo', label: 'Novos' },
  { valor: 'lido', label: 'Lidos' },
  { valor: 'resolvido', label: 'Resolvidos' },
]

const MENSAGEM_VAZIA: Record<StatusAlerta, string> = {
  novo: 'Nenhum alerta no momento — tudo em ordem.',
  lido: 'Nenhum alerta lido.',
  resolvido: 'Nenhum alerta resolvido ainda.',
}

/** Formata um timestamp ISO como data/hora pt-BR (fuso de Brasília). */
function formatarDataHoraBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

// --- Componente ---

interface AlertasClientProps {
  alertas: AlertaPersistido[]
}

export function AlertasClient({ alertas }: AlertasClientProps) {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<StatusAlerta>('novo')
  const [isPending, startTransition] = useTransition()
  const [reavaliando, startReavaliar] = useTransition()

  const porStatus: Record<StatusAlerta, AlertaPersistido[]> = {
    novo: alertas.filter((a) => a.status === 'novo'),
    lido: alertas.filter((a) => a.status === 'lido'),
    resolvido: alertas.filter((a) => a.status === 'resolvido'),
  }

  const visiveis = porStatus[abaAtiva]

  function handleMarcarLido(dbId: string) {
    startTransition(async () => {
      await marcarAlertaComoLido(dbId)
      router.refresh()
    })
  }

  function handleMarcarTodos() {
    startTransition(async () => {
      await marcarTodosComoLidos()
      router.refresh()
    })
  }

  function handleReavaliar() {
    startReavaliar(async () => {
      await reavaliarAlertasAgora()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
          <p className="text-sm text-muted-foreground">
            Tudo que precisa de atencao, em um so lugar.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReavaliar}
          disabled={reavaliando}
        >
          {reavaliando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {reavaliando ? 'Reavaliando...' : 'Reavaliar agora'}
        </Button>
      </div>

      {/* Abas por status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {ABAS.map((aba) => (
            <Button
              key={aba.valor}
              variant={abaAtiva === aba.valor ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setAbaAtiva(aba.valor)}
            >
              {aba.label}
              <Badge variant="outline" className="ml-1 px-1.5 text-[11px]">
                {porStatus[aba.valor].length}
              </Badge>
            </Button>
          ))}
        </div>
        {abaAtiva === 'novo' && porStatus.novo.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarcarTodos}
            disabled={isPending}
            className="text-muted-foreground"
          >
            <CheckCheck className="size-4" />
            Marcar todos como lidos
          </Button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="size-6" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {MENSAGEM_VAZIA[abaAtiva]}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <TooltipProvider>
            {visiveis.map((alerta) => {
              const Icon = TIPO_ICON[alerta.tipo]
              const sevConfig = SEVERIDADE_CONFIG[alerta.severidade]
              return (
                <Card key={alerta.dbId} className="border-none shadow-sm">
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
                      {alerta.status === 'resolvido' && alerta.resolvidoEm && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Resolvido em {formatarDataHoraBr(alerta.resolvidoEm)}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`gap-1 ${sevConfig.badgeClass}`}
                      >
                        <sevConfig.icon className="size-3" />
                        {sevConfig.label}
                      </Badge>
                      {alerta.status === 'novo' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleMarcarLido(alerta.dbId)}
                              disabled={isPending}
                            >
                              <Check className="size-3.5" />
                              <span className="sr-only">Marcar como lido</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Marcar como lido</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}
