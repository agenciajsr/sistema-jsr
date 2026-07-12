import Link from 'next/link'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/dashboard/status-badge'
import type { ClientePerformance } from '@/lib/dashboard/data'
import type { NivelSaude } from '@/lib/mock/dashboard-ref'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function calcularNivel(cpa: number | null, roas: number | null): { nivel: NivelSaude; rotulo: string } {
  if (roas !== null && roas >= 4) return { nivel: 'excelente', rotulo: 'Excelente' }
  if (roas !== null && roas >= 2.5) return { nivel: 'boa', rotulo: 'Boa' }
  if (roas !== null && roas >= 1) return { nivel: 'atencao', rotulo: 'Atenção' }
  if (roas !== null && roas < 1) return { nivel: 'critica', rotulo: 'Crítica' }
  // Sem ROAS: basear no CPA (quanto menor, melhor)
  if (cpa === null) return { nivel: 'boa', rotulo: 'Sem dados' }
  if (cpa < 50) return { nivel: 'excelente', rotulo: 'Excelente' }
  if (cpa < 100) return { nivel: 'boa', rotulo: 'Boa' }
  if (cpa < 200) return { nivel: 'atencao', rotulo: 'Atenção' }
  return { nivel: 'critica', rotulo: 'Crítica' }
}

type Props = {
  clientes: ClientePerformance[]
}

export function PerformanceClienteTable({ clientes }: Props) {
  if (clientes.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Performance por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum cliente com dados de campanha no período.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Performance por Cliente</CardTitle>
        <Link href="/clientes" className="text-xs font-medium text-primary hover:underline">
          Ver todos os clientes
        </Link>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => {
                const { nivel, rotulo } = calcularNivel(c.cpa, c.roas)
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {iniciais(c.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium whitespace-nowrap">{c.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(c.investimento)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorNumero.format(c.resultadoHeroi)} {c.labelHeroi.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.cpa !== null ? formatadorMoeda.format(c.cpa) : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.roas !== null ? `${c.roas.toFixed(2)}x` : '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge nivel={nivel} rotulo={rotulo} />
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
