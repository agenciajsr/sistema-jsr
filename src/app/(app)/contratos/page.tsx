import Link from 'next/link'
import { FileSignature } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { contratosMock } from '@/lib/mock/extra'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function ContratosPage() {
  const contratosAtuais = contratosMock.filter((c) => c.status === 'atual')
  const mrrTotal = contratosAtuais.reduce((acc, c) => acc + c.valorMensal, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          Todos os contratos, de todos os clientes, em um só lugar.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo (CONT-01, adicionado ao escopo em
        2026-07-10). Os contratos reais já existem no banco de dados — esta
        listagem consolidada ainda precisa ser conectada a eles. Enquanto
        isso, os contratos reais continuam visíveis dentro do detalhe de cada
        cliente em <span className="font-medium text-foreground">/clientes</span>.
      </MockNotice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Contratos Vigentes"
          value={String(contratosAtuais.length)}
          icon={FileSignature}
          color="primary"
          helper="contratos ativos no momento"
        />
        <StatCard
          label="MRR dos Contratos Vigentes"
          value={formatadorMoeda.format(mrrTotal)}
          icon={FileSignature}
          color="success"
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Todos os Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor Mensal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratosMock.map((contrato) => (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">
                    <Link href="/clientes" className="hover:underline">
                      {contrato.cliente}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{new Date(contrato.dataVencimento).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <Badge variant={contrato.status === 'atual' ? 'secondary' : 'outline'}>
                      {contrato.status === 'atual' ? 'Contrato Atual' : 'Encerrado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatadorMoeda.format(contrato.valorMensal)}
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
