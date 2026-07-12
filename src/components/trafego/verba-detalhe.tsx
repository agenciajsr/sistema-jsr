import { AlertTriangle, CheckCircle2, TrendingUp, Wallet, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { VerbaCliente, StatusVerba } from '@/lib/trafego/verbas'
import { GraficoVerba } from '@/components/trafego/grafico-verba'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const STATUS_CONFIG: Record<StatusVerba, { label: string; descricao: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ComponentType<{ className?: string }>; cor: string }> = {
  ok: { label: 'Ritmo normal', descricao: 'Gasto dentro do esperado para esta fase do mês.', variant: 'secondary', icon: CheckCircle2, cor: 'text-chart-success' },
  atencao: { label: 'Atenção ao ritmo', descricao: 'O gasto está fora do padrão ideal — pode gastar a verba antes do fim ou subutilizar.', variant: 'default', icon: AlertTriangle, cor: 'text-chart-orange' },
  critico: { label: 'Verba crítica', descricao: 'Verba quase esgotada ou já esgotada para o mês.', variant: 'destructive', icon: XCircle, cor: 'text-destructive' },
}

type Props = {
  dados: VerbaCliente
}

export function VerbaDetalhe({ dados }: Props) {
  const cfg = STATUS_CONFIG[dados.status]
  const Icon = cfg.icon
  const diferencaProjecao = dados.projecao - dados.verbaMensal
  const projecaoAcima = diferencaProjecao > 0

  return (
    <div className="space-y-4">
      {/* Card principal */}
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            <span className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              Verba — {dados.clienteNome}
            </span>
          </CardTitle>
          <Badge variant={cfg.variant} className="gap-1">
            <Icon className="size-3" />
            {cfg.label}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Barra de progresso principal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatadorMoeda.format(dados.gastoMes)} de {formatadorMoeda.format(dados.verbaMensal)}
              </span>
              <span className="font-semibold tabular-nums">{dados.percentual}%</span>
            </div>
            <Progress value={Math.min(dados.percentual, 100)} className="h-3" />
            <p className="text-xs text-muted-foreground">{cfg.descricao}</p>
          </div>

          {/* Métricas resumidas */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Verba Mensal</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatadorMoeda.format(dados.verbaMensal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gasto até agora</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatadorMoeda.format(dados.gastoMes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Projeção fim do mês</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${projecaoAcima ? 'text-destructive' : 'text-chart-success'}`}>
                {formatadorMoeda.format(dados.projecao)}
              </p>
              {diferencaProjecao !== 0 && (
                <p className={`flex items-center gap-1 text-xs ${projecaoAcima ? 'text-destructive' : 'text-chart-success'}`}>
                  <TrendingUp className={`size-3 ${projecaoAcima ? '' : 'rotate-180'}`} />
                  {projecaoAcima ? '+' : ''}{formatadorMoeda.format(diferencaProjecao)} vs verba
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de gasto diário */}
      {dados.serieDiaria.length > 0 && (
        <Card className="border-none shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle className="text-base">Gasto diário no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoVerba serie={dados.serieDiaria} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
