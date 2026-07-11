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
import { performanceClienteMock } from '@/lib/mock/dashboard-ref'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

// Tabela Performance por Cliente. Server component com scroll horizontal.
export function PerformanceClienteTable() {
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
                <TableHead className="text-right">Conversas</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performanceClienteMock.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {iniciais(linha.cliente)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{linha.cliente}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{linha.investimento}</TableCell>
                  <TableCell className="text-right tabular-nums">{linha.conversas}</TableCell>
                  <TableCell className="text-right tabular-nums">{linha.cpa}</TableCell>
                  <TableCell className="text-right tabular-nums">{linha.roas}</TableCell>
                  <TableCell className="text-right tabular-nums">{linha.vendas}</TableCell>
                  <TableCell>
                    <StatusBadge nivel={linha.nivel} rotulo={linha.rotulo} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
