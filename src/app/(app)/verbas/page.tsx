import { eq, and, sql, isNotNull } from 'drizzle-orm'
import {
  AlertTriangle,
  BanknoteX,
  CheckCircle2,
  CreditCard,
  Landmark,
  Wallet,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { db } from '@/lib/db'
import { adAccounts, clientes } from '@/lib/db/schema'
import { SyncTodasButton } from '@/components/verbas/sync-todas-button'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

// Meta account_status: 1=Ativa, 2=Desabilitada, 3=Pendente, 7=Pending Closure, 9=In Grace Period, 100=Pending Risk Review, 101=Pending Settlement, 201=Any Active, 202=Any Closed
const STATUS_MAP: Record<number, { label: string; nivel: 'ok' | 'atencao' | 'critico' }> = {
  1: { label: 'Ativa', nivel: 'ok' },
  2: { label: 'Desabilitada', nivel: 'critico' },
  3: { label: 'Pendente', nivel: 'atencao' },
  7: { label: 'Fechando', nivel: 'critico' },
  9: { label: 'Período de Graça', nivel: 'atencao' },
  100: { label: 'Revisão de Risco', nivel: 'critico' },
  101: { label: 'Pendente Liquidação', nivel: 'atencao' },
}

const FUNDING_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  credit_card: { label: 'Cartão de Crédito', icon: CreditCard },
  prepaid: { label: 'Pré-pago (Saldo)', icon: Wallet },
  invoice: { label: 'Faturamento', icon: Landmark },
}

const NIVEL_CONFIG = {
  ok: { variant: 'secondary' as const, icon: CheckCircle2, cor: 'text-chart-success' },
  atencao: { variant: 'default' as const, icon: AlertTriangle, cor: 'text-chart-orange' },
  critico: { variant: 'destructive' as const, icon: XCircle, cor: 'text-destructive' },
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

// Threshold: contas com saldo abaixo de R$ 100 são consideradas "saldo baixo"
const SALDO_BAIXO_THRESHOLD = 100

export default async function VerbasPage() {
  const contas = await db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      metaAccountId: adAccounts.metaAccountId,
      accountStatus: adAccounts.accountStatus,
      saldo: adAccounts.saldo,
      fundingSource: adAccounts.fundingSource,
      ativo: adAccounts.ativo,
      updatedAt: adAccounts.updatedAt,
      clienteId: adAccounts.clienteId,
      clienteNome: clientes.nome,
    })
    .from(adAccounts)
    .leftJoin(clientes, eq(adAccounts.clienteId, clientes.id))
    .where(eq(adAccounts.ativo, true))
    .orderBy(adAccounts.nome)

  // KPIs
  const totalContas = contas.length
  const contasAtivas = contas.filter((c) => c.accountStatus === 1).length
  const contasComProblema = contas.filter((c) => c.accountStatus !== null && c.accountStatus !== 1).length
  const contasSaldoBaixo = contas.filter(
    (c) => c.saldo !== null && Number(c.saldo) < SALDO_BAIXO_THRESHOLD && Number(c.saldo) >= 0
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verbas</h1>
          <p className="text-sm text-muted-foreground">
            Controle operacional de contas de anúncio — saldo, status e alertas de pagamento.
          </p>
        </div>
        <SyncTodasButton />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de Contas" value={String(totalContas)} icon={Wallet} color="primary" />
        <StatCard label="Contas Ativas" value={String(contasAtivas)} icon={CheckCircle2} color="success" />
        <StatCard label="Com Problema" value={String(contasComProblema)} icon={XCircle} color="danger" />
        <StatCard label="Saldo Baixo" value={String(contasSaldoBaixo)} icon={AlertTriangle} color="warning" />
      </div>

      {/* Alertas */}
      {(contasComProblema > 0 || contasSaldoBaixo > 0) && (
        <Card className="border-destructive/20 bg-destructive/5 shadow-none">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <BanknoteX className="size-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                {contasComProblema > 0 && (
                  <p className="text-sm font-medium text-destructive">
                    {contasComProblema} {contasComProblema === 1 ? 'conta com problema' : 'contas com problema'} — possível falha de pagamento ou restrição
                  </p>
                )}
                {contasSaldoBaixo > 0 && (
                  <p className="text-sm font-medium text-chart-orange">
                    {contasSaldoBaixo} {contasSaldoBaixo === 1 ? 'conta' : 'contas'} com saldo abaixo de {formatadorMoeda.format(SALDO_BAIXO_THRESHOLD)} — risco de parar de veicular
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela principal */}
      {contas.length === 0 ? (
        <Card className="border-none p-12 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto max-w-md space-y-2">
            <Wallet className="mx-auto size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">Nenhuma conta de anúncio</h2>
            <p className="text-sm text-muted-foreground">
              Sincronize suas contas em Campanhas para vê-las aqui.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="border-none shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle className="text-base">Contas de Anúncio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.map((conta) => {
                    const statusInfo = STATUS_MAP[conta.accountStatus ?? 1] ?? { label: 'Desconhecido', nivel: 'atencao' as const }
                    const nivelCfg = NIVEL_CONFIG[statusInfo.nivel]
                    const NivelIcon = nivelCfg.icon
                    const saldo = conta.saldo !== null ? Number(conta.saldo) : null
                    const saldoBaixo = saldo !== null && saldo < SALDO_BAIXO_THRESHOLD

                    const funding = FUNDING_LABELS[conta.fundingSource ?? ''] ?? { label: conta.fundingSource ?? '—', icon: Wallet }
                    const FundingIcon = funding.icon

                    return (
                      <TableRow key={conta.id} className={statusInfo.nivel === 'critico' ? 'bg-destructive/5' : saldoBaixo ? 'bg-chart-orange/5' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium whitespace-nowrap">{conta.nome}</p>
                            <p className="text-xs text-muted-foreground">ID: {conta.metaAccountId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {conta.clienteNome ?? <span className="text-muted-foreground italic">Não vinculada</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <FundingIcon className="size-3.5 text-muted-foreground" />
                            <span className="text-sm whitespace-nowrap">{funding.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {saldo !== null ? (
                            <span className={`tabular-nums font-medium ${saldoBaixo ? 'text-destructive' : ''}`}>
                              {formatadorMoeda.format(saldo)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Sem limite</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={nivelCfg.variant} className="gap-1">
                            <NivelIcon className="size-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(conta.updatedAt, { addSuffix: true, locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
