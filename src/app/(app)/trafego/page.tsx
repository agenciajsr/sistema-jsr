import { AlertTriangle, CheckCircle2, Megaphone, Radio, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { Progress } from '@/components/ui/progress'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { clientesTrafegoMock } from '@/lib/mock/dashboard'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function TrafegoPage() {
  const verbaTotal = clientesTrafegoMock.reduce((acc, c) => acc + c.verbaTotal, 0)
  const verbaGasta = clientesTrafegoMock.reduce((acc, c) => acc + c.verbaGasta, 0)
  const campanhasAtivas = clientesTrafegoMock
    .flatMap((c) => c.campanhas)
    .filter((c) => c.status === 'ativa').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tráfego Pago</h1>
        <p className="text-sm text-muted-foreground">
          Status das contas de anúncio e campanhas por cliente.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. A sincronização real com Meta Ads é
        implementada na Fase 2 do roadmap (Google Ads despriorizado — nenhum
        cliente ativo usa hoje); os alertas de verba (limiar configurável)
        entram na Fase 3.
      </MockNotice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Verba Total do Mês"
          value={formatadorMoeda.format(verbaTotal)}
          icon={Wallet}
          color="primary"
        />
        <StatCard
          label="Verba Consumida"
          value={formatadorMoeda.format(verbaGasta)}
          icon={Radio}
          color="success"
          helper={`${Math.round((verbaGasta / verbaTotal) * 100)}% do total`}
        />
        <StatCard
          label="Campanhas Ativas"
          value={String(campanhasAtivas)}
          icon={Megaphone}
          color="warning"
        />
      </div>

      <div className="space-y-4">
        {clientesTrafegoMock.map((cliente) => {
          const percentualVerba = Math.round((cliente.verbaGasta / cliente.verbaTotal) * 100)
          return (
            <Card key={cliente.id} className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{cliente.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {cliente.nicho} · última sincronização {cliente.ultimaSync}
                  </p>
                </div>
                <Badge
                  variant={cliente.contaStatus === 'ativa' ? 'secondary' : 'destructive'}
                  className="gap-1"
                >
                  {cliente.contaStatus === 'ativa' ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  {cliente.contaStatus === 'ativa' ? 'Conta ativa' : 'Conta com problema'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Verba: {formatadorMoeda.format(cliente.verbaGasta)} de{' '}
                      {formatadorMoeda.format(cliente.verbaTotal)}
                    </span>
                    <span>{percentualVerba}%</span>
                  </div>
                  <Progress value={percentualVerba} />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cliente.campanhas.map((campanha) => (
                      <TableRow key={campanha.nome}>
                        <TableCell className="font-medium">{campanha.nome}</TableCell>
                        <TableCell>{campanha.plataforma}</TableCell>
                        <TableCell>
                          <Badge variant={campanha.status === 'ativa' ? 'secondary' : 'outline'}>
                            {campanha.status === 'ativa' ? 'Ativa' : 'Pausada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatadorMoeda.format(campanha.gasto)}
                        </TableCell>
                        <TableCell className="text-right">{campanha.resultado}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
