import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { VerbaResumo, StatusVerba } from '@/lib/trafego/verbas'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const STATUS_CONFIG: Record<StatusVerba, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ComponentType<{ className?: string }> }> = {
  ok: { label: 'Normal', variant: 'secondary', icon: CheckCircle2 },
  atencao: { label: 'Atenção', variant: 'default', icon: AlertTriangle },
  critico: { label: 'Crítico', variant: 'destructive', icon: XCircle },
}

type Props = {
  verbas: VerbaResumo[]
}

export function PainelVerbas({ verbas }: Props) {
  if (verbas.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Controle de Verbas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum cliente com verba mensal configurada. Configure a verba na ficha do cliente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">Controle de Verbas — Visão Geral</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Verba</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="w-[120px]">Uso</TableHead>
                <TableHead className="text-right">Projeção</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verbas.map((v) => {
                const cfg = STATUS_CONFIG[v.status]
                const Icon = cfg.icon
                return (
                  <TableRow key={v.clienteId}>
                    <TableCell className="font-medium whitespace-nowrap">{v.clienteNome}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(v.verbaMensal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(v.gastoMes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(v.percentual, 100)} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums text-muted-foreground w-8">
                          {v.percentual}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(v.projecao)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="gap-1">
                        <Icon className="size-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
