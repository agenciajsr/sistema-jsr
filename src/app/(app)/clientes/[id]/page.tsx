import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { format, parseISO } from 'date-fns'
import { Activity, CalendarClock, TrendingUp, Wallet } from 'lucide-react'

import { deleteCliente } from '@/actions/clientes'
import { deleteContrato, getContratosDoCliente } from '@/actions/contratos'
import { getChecklistDoCliente } from '@/actions/checklist'
import { getAcompanhamentosDoCliente } from '@/actions/acompanhamento'
import { getCobrancasDoCliente } from '@/actions/financeiro'
import { getContasDoCliente, getContasNaoVinculadas } from '@/actions/trafego'
import { getAlertasDoCliente } from '@/actions/alertas'
import { getResumoCliente } from '@/lib/trafego/aggregate'
import { ContratoForm } from '@/components/contrato-form'
import { ChecklistCliente } from '@/components/ficha/checklist-cliente'
import { AcompanhamentoForm } from '@/components/ficha/acompanhamento-form'
import { CobrancaCliente } from '@/components/ficha/cobranca-cliente'
import { VincularContaFicha } from '@/components/ficha/vincular-conta-ficha'
import { StatCard } from '@/components/stat-card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'

type Cliente = typeof clientes.$inferSelect

// D-10: cores exatas de badge de status (01-UI-SPEC.md § Status Badge Colors).
const STATUS_LABEL: Record<Cliente['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

const STATUS_COLOR: Record<Cliente['status'], string> = {
  ativo: '#16A34A',
  pausado: '#D97706',
  encerrado: '#71717A',
}

const NICHO_LABEL: Record<Cliente['nicho'], string> = {
  ecommerce: 'E-commerce',
  negocio_local: 'Negócio Local',
  infoproduto: 'Infoproduto',
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(data: string): string {
  return format(parseISO(data), 'dd/MM/yyyy')
}

function formatarDataHora(data: Date): string {
  return format(data, 'dd/MM/yyyy HH:mm')
}

// Status da conta de anúncio (Meta accountStatus) → rótulo + cor semântica do StatCard.
function derivarStatusConta(
  accountStatus: number | null,
): { label: string; color: 'success' | 'warning' | 'danger' } {
  if (accountStatus === 1) return { label: 'Ativa', color: 'success' }
  if (accountStatus === 2 || accountStatus === 3) return { label: 'Com restrição', color: 'warning' }
  return { label: 'Inativa', color: 'danger' }
}

// Faixa de alertas: borda por severidade.
const SEVERIDADE_BORDA: Record<'critico' | 'atencao' | 'info', string> = {
  critico: 'border-l-destructive',
  atencao: 'border-l-chart-warning',
  info: 'border-l-primary',
}

// Server Actions inline: mantêm a checagem role === 'admin' e a copy exata de
// confirmação diretamente neste arquivo (D-03), sem extrair para um client
// component separado.
async function excluirClienteAction(clienteId: string) {
  'use server'
  const resultado = await deleteCliente(clienteId)
  if (!('error' in resultado)) {
    redirect('/clientes')
  }
}

async function excluirContratoAction(contratoId: string) {
  'use server'
  await deleteContrato(contratoId)
}

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, id),
  })
  if (!cliente) {
    notFound()
  }

  const [
    { contratoAtual, historico },
    usuario,
    cobrancas,
    contasDoCliente,
    naoVinculadas,
    resumo,
    checklist,
    acompanhamentos,
    alertas,
  ] = await Promise.all([
    getContratosDoCliente(id),
    getCurrentUser(),
    getCobrancasDoCliente(id),
    getContasDoCliente(id),
    getContasNaoVinculadas(),
    getResumoCliente(id, '30d'),
    getChecklistDoCliente(id),
    getAcompanhamentosDoCliente(id),
    getAlertasDoCliente(id),
  ])

  // D-03: exclusão de cliente/contrato é exclusiva do Admin.
  const isAdmin = usuario?.role === 'admin'

  // D-06: histórico exclui o contrato vigente, que já é exibido em destaque acima.
  const registrosAnteriores = historico.filter((contrato) => contrato.id !== contratoAtual?.id)

  // KPI "Próxima cobrança": entre as não-pagas, a de data futura mais próxima;
  // se nenhuma futura, a não-paga mais recente.
  const naoPagas = cobrancas.filter((c) => c.status !== 'pago')
  const hojeStr = new Date().toISOString().slice(0, 10)
  const futuras = naoPagas
    .filter((c) => c.data >= hojeStr)
    .sort((a, b) => a.data.localeCompare(b.data))
  const proximaCobranca =
    futuras[0] ??
    [...naoPagas].sort((a, b) => b.data.localeCompare(a.data))[0] ??
    null

  // KPI "Status da conta": deriva da primeira conta vinculada (se houver).
  const statusConta = contasDoCliente.length > 0
    ? derivarStatusConta(contasDoCliente[0].accountStatus)
    : null

  return (
    <div className="space-y-6">
      {/* Cabeçalho estilo Painel */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">{cliente.nome}</h1>
          <div className="flex items-center gap-2">
            <Badge
              style={{ backgroundColor: STATUS_COLOR[cliente.status] }}
              className="text-white"
            >
              {STATUS_LABEL[cliente.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {NICHO_LABEL[cliente.nicho]}
            </span>
          </div>
          {(cliente.contatoNome || cliente.contatoTelefone || cliente.contatoEmail) && (
            <p className="text-sm text-muted-foreground">
              Contato responsável: {[cliente.contatoNome, cliente.contatoTelefone, cliente.contatoEmail]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {cliente.notas && <p className="text-sm text-muted-foreground">{cliente.notas}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/clientes/${id}/editar`}>Editar</Link>
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Excluir cliente</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                  <AlertDialogDescription>
                    {'Esta ação não pode ser desfeita. O cliente e todo o histórico de contratos vinculados serão removidos permanentemente. Deseja continuar?'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <form action={excluirClienteAction.bind(null, id)}>
                    <AlertDialogAction type="submit" variant="destructive">
                      Excluir cliente
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Faixa de alertas do cliente */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className={`rounded-lg border border-l-4 bg-secondary/40 p-3 ${SEVERIDADE_BORDA[alerta.severidade]}`}
            >
              <p className="text-sm font-medium">{alerta.titulo}</p>
              <p className="text-sm text-muted-foreground">{alerta.detalhe}</p>
            </div>
          ))}
        </div>
      )}

      {/* Faixa de KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR do cliente"
          value={contratoAtual ? formatadorMoeda.format(Number(contratoAtual.valorMensal)) : '—'}
          icon={Wallet}
          color="success"
          helper="receita mensal recorrente"
        />
        <StatCard
          label="Próxima cobrança"
          value={proximaCobranca ? formatarData(proximaCobranca.data) : '—'}
          icon={CalendarClock}
          color="primary"
          helper={
            proximaCobranca
              ? proximaCobranca.status === 'vencido'
                ? 'Vencida'
                : 'Pendente'
              : 'sem cobranças em aberto'
          }
        />
        <StatCard
          label="Verba rodando"
          value={resumo?.temDados ? formatadorMoeda.format(resumo.totais.spend) : '—'}
          icon={TrendingUp}
          color="warning"
          helper="últimos 30 dias"
        />
        <StatCard
          label="Status da conta"
          value={statusConta ? statusConta.label : '—'}
          icon={Activity}
          color={statusConta ? statusConta.color : 'primary'}
          helper="saúde das contas de anúncio"
        />
      </div>

      {/* Corpo em abas */}
      <Tabs defaultValue="contrato" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contrato">📄 Contrato &amp; Cobrança</TabsTrigger>
          <TabsTrigger value="contas">📊 Contas de anúncio</TabsTrigger>
          <TabsTrigger value="checklist">✅ Checklist</TabsTrigger>
          <TabsTrigger value="acompanhamento">📝 Acompanhamento</TabsTrigger>
        </TabsList>

        {/* Aba: Contrato & Cobrança (dados REAIS) */}
        <TabsContent value="contrato" className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] leading-tight font-semibold">Contrato Atual</h2>
              {contratoAtual && <Badge variant="outline">Contrato Atual</Badge>}
            </div>

            {contratoAtual ? (
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Início: </span>
                  {formatarData(contratoAtual.dataInicio)}
                </p>
                <p>
                  <span className="text-muted-foreground">Vencimento: </span>
                  {formatarData(contratoAtual.dataVencimento)}
                </p>
                <p>
                  <span className="text-muted-foreground">Valor mensal: </span>
                  {formatadorMoeda.format(Number(contratoAtual.valorMensal))}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
            )}

            <ContratoForm clienteId={id} />
          </section>

          <section className="space-y-4">
            <h2 className="text-[20px] leading-tight font-semibold">Histórico de Contratos</h2>

            {registrosAnteriores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contrato anterior registrado.</p>
            ) : (
              <ul className="space-y-3">
                {registrosAnteriores.map((contrato) => (
                  <li
                    key={contrato.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                      <p>
                        <span className="text-muted-foreground">Início: </span>
                        {formatarData(contrato.dataInicio)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Vencimento: </span>
                        {formatarData(contrato.dataVencimento)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Valor mensal: </span>
                        {formatadorMoeda.format(Number(contrato.valorMensal))}
                      </p>
                    </div>

                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            Excluir contrato
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
                            <AlertDialogDescription>
                              {'Esta ação não pode ser desfeita. Este registro de contrato será removido permanentemente do histórico. Deseja continuar?'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <form action={excluirContratoAction.bind(null, contrato.id)}>
                              <AlertDialogAction type="submit" variant="destructive">
                                Excluir contrato
                              </AlertDialogAction>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-[20px] leading-tight font-semibold">💳 Cobrança</h2>
            <CobrancaCliente clienteId={id} usaAsaas={cliente.usaAsaas} cobrancas={cobrancas} />
          </section>
        </TabsContent>

        {/* Aba: Contas de anúncio (dados REAIS) */}
        <TabsContent value="contas" className="space-y-4">
          {contasDoCliente.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nenhuma conta de anúncio vinculada a este cliente ainda.
              </p>
              <VincularContaFicha clienteId={id} contasNaoVinculadas={naoVinculadas} />
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Contas vinculadas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contasDoCliente.map((conta) => {
                    const s = derivarStatusConta(conta.accountStatus)
                    return (
                      <div
                        key={conta.id}
                        className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{conta.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {conta.plataforma === 'meta' ? 'Meta' : 'Google'} · {conta.metaAccountId}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            s.color === 'success'
                              ? 'w-fit bg-chart-success/15 text-chart-success'
                              : s.color === 'warning'
                                ? 'w-fit bg-chart-warning/15 text-chart-warning'
                                : 'w-fit bg-destructive/15 text-destructive'
                          }
                        >
                          {s.label}
                        </Badge>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {resumo?.temDados && (
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Performance (últimos 30 dias)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                      <span className="font-medium">
                        {formatadorMoeda.format(resumo.totais.spend)}{' '}
                        <span className="text-muted-foreground">investidos</span>
                      </span>
                      <span className="text-muted-foreground">
                        {resumo.contasUnificadas}{' '}
                        {resumo.contasUnificadas === 1 ? 'conta unificada' : 'contas unificadas'}
                      </span>
                      <span className="text-muted-foreground">
                        {resumo.heroi.label}: {resumo.totais[resumo.heroi.chave]}
                      </span>
                    </div>

                    {resumo.ranking.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase">
                          Ranking de campanhas
                        </p>
                        {resumo.ranking.map((campanha) => (
                          <div
                            key={campanha.campaignId}
                            className="flex flex-col gap-1 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <p className="text-sm font-medium">{campanha.campaignName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatadorMoeda.format(campanha.spend)} ·{' '}
                              {campanha.resultadoPrimario} {resumo.heroi.label.toLowerCase()}
                              {campanha.cpaOuCpl != null
                                ? ` · ${formatadorMoeda.format(campanha.cpaOuCpl)} por resultado`
                                : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
                <p className="text-sm font-medium">Vincular outra conta</p>
                <VincularContaFicha clienteId={id} contasNaoVinculadas={naoVinculadas} />
              </section>
            </div>
          )}
        </TabsContent>

        {/* Aba: Checklist (dados REAIS, persistidos) */}
        <TabsContent value="checklist" className="space-y-4">
          <ChecklistCliente
            clienteId={id}
            itens={checklist.map((i) => ({
              id: i.id,
              tarefa: i.tarefa,
              frequencia: i.frequencia,
              concluido: i.concluido,
            }))}
          />
        </TabsContent>

        {/* Aba: Acompanhamento (dados REAIS, persistidos) */}
        <TabsContent value="acompanhamento" className="space-y-4">
          {acompanhamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum registro de acompanhamento ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {acompanhamentos.map((registro) => (
                <li key={registro.id} className="flex gap-3 rounded-lg border bg-background p-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback>{registro.autorNome.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{registro.autorNome}</span>{' '}
                      <span className="text-muted-foreground">
                        · {formatarDataHora(registro.createdAt)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">{registro.nota}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <AcompanhamentoForm clienteId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
