import { FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { relatoriosMock } from '@/lib/mock/dashboard'

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Relatório semanal por cliente, pronto para copiar e colar.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. A geração automática do relatório
        semanal a partir de dados reais de campanha é implementada na Fase 5
        do roadmap.
      </MockNotice>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Relatórios da Semana (30/06 – 06/07)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gerado em</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatoriosMock.map((r) => (
                <TableRow key={r.cliente}>
                  <TableCell className="font-medium">{r.cliente}</TableCell>
                  <TableCell>{r.periodo}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'gerado' ? 'secondary' : 'outline'}>
                      {r.status === 'gerado' ? 'Gerado' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.geradoEm ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled={r.status !== 'gerado'}>
                      <FileText className="size-4" />
                      Ver / Copiar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
