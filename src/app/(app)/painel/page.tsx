import { AlertTriangle, Bell, TrendingUp, Users, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { StatCard } from '@/components/stat-card'
import { alertasMock, clientesTrafegoMock, financeiroMock } from '@/lib/mock/dashboard'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function PainelPage() {
  const mrrTotal = financeiroMock.reduce((acc, c) => acc + c.mrr, 0)
  const clientesAtivos = clientesTrafegoMock.length
  const contasComProblema = clientesTrafegoMock.filter((c) => c.contaStatus === 'problema').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          Painel consolidado de todos os clientes ativos.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo. Os números reais de verba, campanhas e
        performance passam a aparecer aqui quando a integração com Meta Ads
        (Fase 2) e o painel de tráfego (Fase 3) forem implementados.
      </MockNotice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR Total"
          value={formatadorMoeda.format(mrrTotal)}
          icon={Wallet}
          color="success"
          trend={{ value: '8,2%', direction: 'up' }}
          helper="soma dos contratos ativos"
        />
        <StatCard
          label="Clientes Ativos"
          value={String(clientesAtivos)}
          icon={Users}
          color="primary"
          helper="com conta de anúncio monitorada"
        />
        <StatCard
          label="Contas com Problema"
          value={String(contasComProblema)}
          icon={AlertTriangle}
          color="danger"
          helper="precisam de atenção imediata"
        />
        <StatCard
          label="Alertas Abertos"
          value={String(alertasMock.length)}
          icon={Bell}
          color="warning"
          helper="verba, contrato e performance"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">O que precisa de atenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertasMock.map((alerta) => (
              <div
                key={alerta.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="text-sm font-medium">{alerta.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {alerta.cliente} · {alerta.detalhe}
                  </p>
                </div>
                <Badge variant={alerta.severidade === 'critico' ? 'destructive' : 'secondary'}>
                  {alerta.severidade === 'critico' ? 'Crítico' : 'Atenção'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Status das contas de anúncio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientesTrafegoMock.map((cliente) => (
              <div
                key={cliente.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="text-sm font-medium">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatadorMoeda.format(cliente.verbaGasta)} de{' '}
                    {formatadorMoeda.format(cliente.verbaTotal)} · sync {cliente.ultimaSync}
                  </p>
                </div>
                <Badge
                  variant={cliente.contaStatus === 'ativa' ? 'secondary' : 'destructive'}
                  className="gap-1"
                >
                  {cliente.contaStatus === 'ativa' ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  {cliente.contaStatus === 'ativa' ? 'Ativa' : 'Com problema'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
