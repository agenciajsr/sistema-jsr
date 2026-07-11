import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { format, parseISO } from 'date-fns'
import { Activity, CalendarClock, TrendingUp, Wallet } from 'lucide-react'

import { deleteCliente } from '@/actions/clientes'
import { deleteContrato, getContratosDoCliente } from '@/actions/contratos'
import { ContratoForm } from '@/components/contrato-form'
import { ChecklistCliente } from '@/components/ficha/checklist-cliente'
import { MockNotice } from '@/components/mock-notice'
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
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { getMockDaFicha } from '@/lib/mock/ficha-cliente'

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

// Mapeia o status da conta de anúncio (mock) para rótulo legível + cor semântica
// do StatCard. Fora do mock, a KPI mostra '—' em estado neutro (primary).
const STATUS_CONTA: Record<
  'ativa' | 'atencao' | 'problema',
  { label: string; color: 'success' | 'warning' | 'danger' }
> = {
  ativa: { label: 'Ativa', color: 'success' },
  atencao: { label: 'Atenção', color: 'warning' },
  problema: { label: 'Problema', color: 'danger' },
}

// Status de cobrança (mock/visual) → cor semântica.
const STATUS_COBRANCA: Record<
  'pago' | 'pendente' | 'vencido',
  { label: string; className: string }
> = {
  pago: { label: 'Pago', className: 'bg-chart-success/15 text-chart-success' },
  pendente: { label: 'Pendente', className: 'bg-chart-warning/15 text-chart-warning' },
  vencido: { label: 'Vencido', className: 'bg-destructive/15 text-destructive' },
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

  const [{ contratoAtual, historico }, usuario] = await Promise.all([
    getContratosDoCliente(id),
    getCurrentUser(),
  ])

  // D-03: exclusão de cliente/contrato é exclusiva do Admin.
  const isAdmin = usuario?.role === 'admin'

  // D-06: histórico exclui o contrato vigente, que já é exibido em destaque acima.
  const registrosAnteriores = historico.filter((contrato) => contrato.id !== contratoAtual?.id)

  // Dados de exemplo (mock) casados pelo NOME do cliente — nunca quebram.
  const { trafego, financeiro, checklist, acompanhamento, cobranca } = getMockDaFicha(cliente.nome)

  const statusConta = trafego ? STATUS_CONTA[trafego.contaStatus] : null

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

      {/* Faixa de KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR do cliente"
          value={financeiro ? formatadorMoeda.format(financeiro.mrr) : '—'}
          icon={Wallet}
          color="success"
          helper="receita mensal recorrente"
        />
        <StatCard
          label="Próxima cobrança"
          value={cobranca.diaCobranca ? `Dia ${cobranca.diaCobranca}` : '—'}
          icon={CalendarClock}
          color="primary"
          helper={STATUS_COBRANCA[cobranca.status].label}
        />
        <StatCard
          label="Verba rodando"
          value={trafego ? formatadorMoeda.format(trafego.verbaTotal) : '—'}
          icon={TrendingUp}
          color="warning"
          helper="somando as contas de ads"
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

        {/* Aba: Contrato & Cobrança (dados REAIS + bloco de cobrança MOCK) */}
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
            <MockNotice>
              Bloco de cobrança com dados de exemplo (controle manual). A cobrança
              real via Asaas e a persistência de status passam a valer em um
              incremento funcional futuro.
            </MockNotice>
            <Card className="border-none shadow-sm">
              <CardContent className="grid grid-cols-1 gap-4 pt-6 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Usa Asaas</p>
                  <p className="font-medium">{cobranca.usaAsaas ? 'Sim' : 'Não'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dia de cobrança</p>
                  <p className="font-medium">{cobranca.diaCobranca ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="secondary"
                    className={STATUS_COBRANCA[cobranca.status].className}
                  >
                    {STATUS_COBRANCA[cobranca.status].label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        {/* Aba: Contas de anúncio (MOCK) */}
        <TabsContent value="contas" className="space-y-4">
          <MockNotice>
            Dados de exemplo. Os números reais de contas, verba e campanhas
            passam a aparecer aqui quando a integração com Meta Ads (Fase 2) e o
            painel de tráfego (Fase 3) forem implementados.
          </MockNotice>

          {trafego ? (
            <div className="space-y-4">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Verba do mês</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {trafego.contas} {trafego.contas === 1 ? 'conta de anúncio' : 'contas de anúncio'}
                  </p>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {formatadorMoeda.format(trafego.verbaGasta)} de{' '}
                      {formatadorMoeda.format(trafego.verbaTotal)}
                    </span>
                    <span className="text-muted-foreground">sync {trafego.ultimaSync}</span>
                  </div>
                  <Progress value={(trafego.verbaGasta / trafego.verbaTotal) * 100} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Campanhas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trafego.campanhas.map((campanha) => (
                    <div
                      key={campanha.nome}
                      className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{campanha.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {campanha.plataforma} · {formatadorMoeda.format(campanha.gasto)} ·{' '}
                          {campanha.resultado} resultados
                        </p>
                      </div>
                      {campanha.status === 'ativa' ? (
                        <Badge
                          variant="secondary"
                          className="w-fit bg-chart-success/15 text-chart-success"
                        >
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="w-fit">
                          Pausada
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este cliente ainda não tem contas de anúncio no sistema de exemplo.
            </p>
          )}
        </TabsContent>

        {/* Aba: Checklist (MOCK, interativo local) */}
        <TabsContent value="checklist" className="space-y-4">
          <MockNotice>
            Dados de exemplo. As marcações não são salvas — a persistência do
            checklist vem em um incremento funcional futuro.
          </MockNotice>
          <ChecklistCliente
            itens={checklist.map((i) => ({
              id: i.id,
              tarefa: i.tarefa,
              frequencia: i.frequencia,
              feito: i.feito,
            }))}
          />
        </TabsContent>

        {/* Aba: Acompanhamento (MOCK) */}
        <TabsContent value="acompanhamento" className="space-y-4">
          <MockNotice>
            Dados de exemplo. O registro de notas passa a ser salvo quando a
            persistência do acompanhamento for implementada.
          </MockNotice>

          {acompanhamento.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum registro de acompanhamento ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {acompanhamento.map((registro) => (
                <li key={registro.id} className="flex gap-3 rounded-lg border bg-background p-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback>{registro.autor.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{registro.autor}</span>{' '}
                      <span className="text-muted-foreground">· {registro.data}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{registro.nota}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Textarea
            disabled
            placeholder="Registro de notas será salvo quando a persistência for implementada."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
