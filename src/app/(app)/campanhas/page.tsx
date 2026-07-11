import { AlertTriangle, CheckCircle2, Megaphone, Radio, Wallet } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SyncButton } from '@/components/trafego/sync-button'
import { getTrafegoData, getUltimaSync } from '@/actions/trafego'
import type { TrafegoAccount } from '@/actions/trafego'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorNumero = new Intl.NumberFormat('pt-BR')

const formatadorPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Agrega campanhas por campaignId: soma spend/impressions/clicks/reach dos ultimos 7 dias */
function agregarCampanhas(conta: TrafegoAccount) {
  const mapa = new Map<string, {
    campaignId: string
    campaignName: string
    spend: number
    impressions: number
    clicks: number
    reach: number
    ctr: number | null
  }>()

  for (const c of conta.campanhas) {
    const existing = mapa.get(c.campaignId)
    if (existing) {
      existing.spend += Number(c.spend)
      existing.impressions += c.impressions
      existing.clicks += c.clicks
      existing.reach += c.reach
    } else {
      mapa.set(c.campaignId, {
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        spend: Number(c.spend),
        impressions: c.impressions,
        clicks: c.clicks,
        reach: c.reach,
        ctr: c.ctr ? Number(c.ctr) : null,
      })
    }
  }

  // Recalcular CTR apos agregacao
  return Array.from(mapa.values()).map((item) => ({
    ...item,
    ctr: item.clicks > 0 && item.impressions > 0
      ? (item.clicks / item.impressions) * 100
      : item.ctr,
  }))
}

export default async function CampanhasPage() {
  const [contas, ultimaSync] = await Promise.all([
    getTrafegoData(),
    getUltimaSync(),
  ])

  const gastoTotal = contas.reduce((acc, c) => acc + c.spendTotal, 0)
  const contasAtivas = contas.filter((c) => c.accountStatus === 1).length

  // Campanhas unicas nos ultimos 7 dias
  const campanhasUnicas = new Set<string>()
  for (const conta of contas) {
    for (const c of conta.campanhas) {
      campanhasUnicas.add(c.campaignId)
    }
  }

  const temDados = contas.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Status das contas de anúncio e campanhas por cliente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ultimaSync && (
            <span className="text-xs text-muted-foreground">
              Última sync: {formatDistanceToNow(ultimaSync, { addSuffix: true, locale: ptBR })}
            </span>
          )}
          <SyncButton />
        </div>
      </div>

      {!temDados ? (
        <Card className="border-none p-12 text-center shadow-sm">
          <div className="mx-auto max-w-md space-y-4">
            <Radio className="mx-auto size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">Nenhuma conta de anúncio sincronizada</h2>
            <p className="text-sm text-muted-foreground">
              Clique em Sincronizar para buscar as contas da sua Business Manager.
            </p>
            <div className="flex justify-center">
              <SyncButton />
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Gasto Total (7d)"
              value={formatadorMoeda.format(gastoTotal)}
              icon={Wallet}
              color="primary"
            />
            <StatCard
              label="Contas Ativas"
              value={String(contasAtivas)}
              icon={Radio}
              color="success"
            />
            <StatCard
              label="Campanhas (7d)"
              value={String(campanhasUnicas.size)}
              icon={Megaphone}
              color="warning"
            />
          </div>

          <div className="space-y-4">
            {contas.map((conta) => {
              const campanhasAgregadas = agregarCampanhas(conta)

              return (
                <Card key={conta.id} className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{conta.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {conta.clienteNome ?? 'Sem cliente associado'}
                        {conta.ultimaSync && (
                          <> · sync {formatDistanceToNow(conta.ultimaSync, { addSuffix: true, locale: ptBR })}</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant={conta.accountStatus === 1 ? 'secondary' : 'destructive'}
                      className="gap-1"
                    >
                      {conta.accountStatus === 1 ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <AlertTriangle className="size-3" />
                      )}
                      {conta.accountStatus === 1 ? 'Conta ativa' : 'Conta com problema'}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {campanhasAgregadas.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhum dado de campanha. Clique em Sincronizar para buscar dados.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campanha</TableHead>
                            <TableHead className="text-right">Gasto (7d)</TableHead>
                            <TableHead className="text-right">Impressões</TableHead>
                            <TableHead className="text-right">Cliques</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campanhasAgregadas.map((campanha) => (
                            <TableRow key={campanha.campaignId}>
                              <TableCell className="font-medium">{campanha.campaignName}</TableCell>
                              <TableCell className="text-right">
                                {formatadorMoeda.format(campanha.spend)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatadorNumero.format(campanha.impressions)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatadorNumero.format(campanha.clicks)}
                              </TableCell>
                              <TableCell className="text-right">
                                {campanha.ctr !== null ? `${formatadorPct.format(campanha.ctr)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
