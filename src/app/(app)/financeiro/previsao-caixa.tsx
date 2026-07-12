'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PrevisaoData = {
  totalReceber: number
  totalPagar: number
  saldoProjetado: number
  items: Array<{
    descricao: string
    valor: number
    data: string
    tipo: 'receita' | 'despesa'
  }>
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function PrevisaoCaixa({ previsao }: { previsao: PrevisaoData }) {
  const saldoPositivo = previsao.saldoProjetado >= 0

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Previsao de Caixa -- Proximos 30 dias</CardTitle>
          <p className="text-xs text-muted-foreground">
            Baseado em contratos ativos, recorrencias e historico
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-chart-success/5 p-4">
              <p className="text-xs text-muted-foreground">A Receber</p>
              <p className="text-xl font-semibold text-chart-success tabular-nums">
                {formatadorMoeda.format(previsao.totalReceber)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-destructive/5 p-4">
              <p className="text-xs text-muted-foreground">A Pagar</p>
              <p className="text-xl font-semibold text-destructive tabular-nums">
                {formatadorMoeda.format(previsao.totalPagar)}
              </p>
            </div>
            <div className={`rounded-lg border border-border p-4 ${saldoPositivo ? 'bg-blue-500/5' : 'bg-destructive/5'}`}>
              <p className="text-xs text-muted-foreground">Saldo Projetado</p>
              <p className={`text-xl font-semibold tabular-nums ${saldoPositivo ? 'text-blue-500' : 'text-destructive'}`}>
                {formatadorMoeda.format(previsao.saldoProjetado)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {previsao.items.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Transacoes Projetadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previsao.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">{formatarData(item.data)}</TableCell>
                    <TableCell className="font-medium">{item.descricao}</TableCell>
                    <TableCell>
                      <span className={item.tipo === 'receita' ? 'text-chart-success' : 'text-destructive'}>
                        {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        item.tipo === 'receita' ? 'text-chart-success' : 'text-destructive'
                      }`}
                    >
                      {item.tipo === 'despesa' ? '- ' : ''}
                      {formatadorMoeda.format(item.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {previsao.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma transacao projetada para os proximos 30 dias.
        </div>
      )}
    </div>
  )
}
