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
import Link from 'next/link'

import {
  marcarAlertaComoLido,
  marcarTodosComoLidos,
  reavaliarAlertasAgora,
  resolverAlerta,
  silenciarAlerta,
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
  gasto_sem_resultado: Ban,
  custo_acima_meta: Target,
  ctr_baixo: MousePointerClick,
  gasto_disparado: TrendingDown,
  entrega_parada: AlertTriangle,
  conta_com_problema: AlertTriangle,
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
  gasto_sem_resultado: 'Gasto sem resultado',
  custo_acima_meta: 'Custo x meta',
  ctr_baixo: 'CTR baixo',
  gasto_disparado: 'Pico de gasto',
  entrega_parada: 'Entrega parada',
  conta_com_problema: 'Conta',
}

/** Tipos ligados a campanha/conta — ganham o atalho "Ver campanha". */
const TIPOS_CAMPANHA = new Set<TipoAlerta>([
  'cpa_alto',
  'performance_caindo',
  'ctr_caindo',
  'sem_conversao',
  'criativo_rejeitado',
  'fadiga_criativo',
  'gasto_sem_resultado',
  'custo_acima_meta',
  'ctr_baixo',
  'gasto_disparado',
  'entrega_parada',
  'conta_com_problema',
  'verba_baixa',
])

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

  function handleSilenciar(dbId: string) {
    startTransition(async () => {
      await silenciarAlerta(dbId, 7)
      router.refresh()
    })
  }

  function handleResolver(dbId: string) {
    startTransition(async () => {
      await resolverAlerta(dbId)
      router.refresh()
    })
  }

  // Agrupamento por cliente (Feature 2): a lista já vem ordenada por severidade;
  // os grupos seguem a ordem de aparição (pior severidade primeiro).
  const grupos: Array<{ cliente: string; itens: AlertaPersistido[] }> = []
  const grupoPorCliente = new Map<string, AlertaPersistido[]>()
  for (const a of visiveis) {
    const chave = a.clienteNome || 'Geral'
    let itens = grupoPorCliente.get(chave)
    if (!itens) {
      itens = []
      grupoPorCliente.set(chave, itens)
      grupos.push({ cliente: chave, itens })
    }
    itens.push(a)
  }

  const agora = Date.now()

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
        <div className="space-y-5">
          <TooltipProvider>
            {grupos.map((grupo) => (
              <div key={grupo.cliente} className="space-y-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {grupo.cliente}
                  <Badge variant="outline" className="px-1.5 text-[11px]">{grupo.itens.length}</Badge>
                </h2>
                <div className="space-y-3">
            {grupo.itens.map((alerta) => {
              const Icon = TIPO_ICON[alerta.tipo] ?? AlertTriangle
              const sevConfig = SEVERIDADE_CONFIG[alerta.severidade]
              const silenciado =
                alerta.silenciadoAte !== null && new Date(alerta.silenciadoAte).getTime() > agora
              return (
                <Card key={alerta.dbId} className={`border-none shadow-sm ${silenciado ? 'opacity-60' : ''}`}>
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
                      {silenciado && alerta.silenciadoAte && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Silenciado até {formatarDataHoraBr(alerta.silenciadoAte)}
                        </Badge>
                      )}
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
                      {TIPOS_CAMPANHA.has(alerta.tipo) && alerta.clienteId && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/campanhas?cliente=${alerta.clienteId}`}>Ver campanha</Link>
                        </Button>
                      )}
                      {alerta.status !== 'resolvido' && !silenciado && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleSilenciar(alerta.dbId)}
                              disabled={isPending}
                            >
                              Silenciar 7d
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Esconder este alerta por 7 dias</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {alerta.status !== 'resolvido' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleResolver(alerta.dbId)}
                              disabled={isPending}
                            >
                              Resolver
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Marcar como resolvido (reabre se a condição voltar)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
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
                </div>
              </div>
            ))}
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}
