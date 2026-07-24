import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotaoVoltar } from '@/components/ui/botao-voltar'
import { eq } from 'drizzle-orm'
import { format, parseISO } from 'date-fns'
import {
  CalendarDays,
  Mail,
  MapPin,
  Pencil,
  Phone,
} from 'lucide-react'
import { deleteContrato, getContratosDoCliente } from '@/actions/contratos'
import { getAcompanhamentosDoCliente } from '@/actions/acompanhamento'
import { getCobrancasDoCliente } from '@/actions/financeiro'
import { getContasDoCliente, getContasNaoVinculadas } from '@/actions/trafego'
import { getAlertasDoCliente } from '@/actions/alertas'
import { listarDocumentos } from '@/actions/documentos'
import { getResumoCliente, heroiDoObjetivo } from '@/lib/trafego/aggregate'
import { ContratoForm } from '@/components/contrato-form'
import { CobrancaCliente } from '@/components/ficha/cobranca-cliente'
import { FaturasCliente } from '@/components/ficha/faturas-cliente'
import { getFaturasDoCliente } from '@/lib/cobrancas/dados'
import { getTarefasDoClienteFicha } from '@/lib/tarefas/ficha-cliente'
import { TarefasCliente } from '@/components/ficha/tarefas-cliente'
import { VisaoGeralCliente } from '@/components/ficha/visao-geral-cliente'
import { LogoClienteUpload } from '@/components/ficha/logo-cliente-upload'
import { InstagramLogo } from '@/components/ficha/brand-logos'
import { asaasDisponivel } from '@/lib/asaas/client'
import { VincularContaFicha } from '@/components/ficha/vincular-conta-ficha'
import { MetasCliente } from '@/components/ficha/metas-cliente'
import { UploadDocumento } from '@/components/upload-documento'
import { DocumentosLista } from '@/components/documentos-lista'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clientes, profiles, tarefas, tarefaChecklistItems } from '@/lib/db/schema'
import { asc, and, inArray, or, sql } from 'drizzle-orm'
import {
  OnboardingCliente,
  RetencaoCliente,
  SaidaCliente,
  type ProcessoDaFicha,
} from '@/components/ficha/processos-cliente'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

type Cliente = typeof clientes.$inferSelect

// D-10: cores exatas de badge de status (01-UI-SPEC.md § Status Badge Colors).
const STATUS_LABEL: Record<Cliente['status'], string> = {
  ativo: 'Ativo',
  aguardando_inicio: 'Aguardando Início',
  em_aviso: 'Em Aviso',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

const STATUS_COLOR: Record<Cliente['status'], string> = {
  ativo: '#16A34A',
  aguardando_inicio: '#2563EB',
  em_aviso: '#D97706',
  pausado: '#D97706',
  encerrado: '#71717A',
}

const NICHO_LABEL: Record<Cliente['nicho'], string> = {
  ecommerce: 'E-commerce',
  negocio_local: 'Negócio Local',
  infoproduto: 'Infoproduto',
}

const SERVICO_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  site: 'Site / Landing Page',
  criativos: 'Criativos',
  social_media: 'Social Media',
  consultoria: 'Consultoria',
  gestao_trafego: 'Gestão de Tráfego',
  landing_page: 'Landing Page',
  crm_estruturacao: 'CRM / Estruturação',
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(data: string): string {
  return format(parseISO(data), 'dd/MM/yyyy')
}

// Telefone BR para exibição: 10-11 dígitos viram (11) 99999-9999; qualquer
// outro formato é mostrado como foi digitado.
function formatarTelefoneExibicao(v: string): string {
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}

// Iniciais do avatar: primeira letra da primeira e da última palavra do nome.
function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return [partes[0], partes[partes.length - 1]]
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
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
    acompanhamentos,
    alertas,
    docsCliente,
  ] = await Promise.all([
    getContratosDoCliente(id),
    getCurrentUser(),
    getCobrancasDoCliente(id),
    getContasDoCliente(id),
    getContasNaoVinculadas(),
    getResumoCliente(id, '30d'),
    getAcompanhamentosDoCliente(id),
    getAlertasDoCliente(id),
    listarDocumentos(id),
  ])

  // Faturas (tabela cobrancas — Fase 5): query SEQUENCIAL após o lote acima
  // (pool max=3, memória do projeto — não inflar o Promise.all).
  const faturas = await getFaturasDoCliente(id)
  // Tarefas do cliente: também SEQUENCIAL (2 queries agregadas internas,
  // nunca em Promise.all — quick-260717-i26).
  const tarefasFicha = await getTarefasDoClienteFicha(id)
  const asaasConfigurado = asaasDisponivel()

  // Gestor responsável (D-header): o membro da JSR que gere o cliente — NÃO o
  // contato do cliente. Query leve e sequencial (columns só nome).
  const gestor = cliente.gestorId
    ? await db.query.profiles.findFirst({
        where: eq(profiles.id, cliente.gestorId),
        columns: { nome: true, fotoUrl: true },
      })
    : null
  const gestorNome = gestor?.nome ?? null
  const gestorFoto = gestor?.fotoUrl ?? null

  // Serviços contratados (jsonb) → tags/plano na Visão geral.
  const servicos = Array.isArray(cliente.servicosContratados)
    ? (cliente.servicosContratados as string[])
    : []
  const planoLabel =
    servicos.length > 0 ? (SERVICO_LABELS[servicos[0]] ?? servicos[0]) : null

  // Processos (gp5): a fonte única é a TAREFA do processo (etiqueta técnica
  // processo:{tipo} em tarefas.etiquetas) + o checklist dela. 2 queries
  // SEQUENCIAIS (padrão do repo — nunca inflar o Promise.all); try/catch de
  // degradação graciosa.
  let processoOnboarding: ProcessoDaFicha | null = null
  let processoRetencao: ProcessoDaFicha | null = null
  let processoSaida: ProcessoDaFicha | null = null
  try {
    const tarefasProcesso = await db
      .select({
        id: tarefas.id,
        data: tarefas.data,
        status: tarefas.status,
        etiquetas: tarefas.etiquetas,
      })
      .from(tarefas)
      .where(
        and(
          eq(tarefas.clienteId, id),
          eq(tarefas.ehMolde, false),
          or(
            sql`${tarefas.etiquetas} @> '["processo:onboarding"]'::jsonb`,
            sql`${tarefas.etiquetas} @> '["processo:retencao"]'::jsonb`,
            sql`${tarefas.etiquetas} @> '["processo:saida"]'::jsonb`,
          ),
        ),
      )

    const itensPorTarefa = new Map<string, ProcessoDaFicha['itens']>()
    if (tarefasProcesso.length > 0) {
      const itens = await db
        .select({
          id: tarefaChecklistItems.id,
          tarefaId: tarefaChecklistItems.tarefaId,
          texto: tarefaChecklistItems.texto,
          concluido: tarefaChecklistItems.concluido,
          ordem: tarefaChecklistItems.ordem,
        })
        .from(tarefaChecklistItems)
        .where(
          inArray(
            tarefaChecklistItems.tarefaId,
            tarefasProcesso.map((t) => t.id),
          ),
        )
        .orderBy(asc(tarefaChecklistItems.ordem))
      for (const item of itens) {
        const lista = itensPorTarefa.get(item.tarefaId) ?? []
        lista.push({ id: item.id, texto: item.texto, concluido: item.concluido, ordem: item.ordem })
        itensPorTarefa.set(item.tarefaId, lista)
      }
    }

    for (const t of tarefasProcesso) {
      const etiquetas = Array.isArray(t.etiquetas) ? (t.etiquetas as string[]) : []
      const processo: ProcessoDaFicha = {
        tarefaId: t.id,
        data: t.data,
        status: t.status,
        itens: itensPorTarefa.get(t.id) ?? [],
      }
      if (etiquetas.includes('processo:onboarding')) processoOnboarding = processo
      else if (etiquetas.includes('processo:retencao')) processoRetencao = processo
      else if (etiquetas.includes('processo:saida')) processoSaida = processo
    }
  } catch (e) {
    console.error('[ficha] tarefas de processo indisponiveis', e)
  }

  // D-03: exclusão de cliente/contrato é exclusiva do Admin.
  const isAdmin = usuario?.role === 'admin'

  // D-06: histórico exclui o contrato vigente, que já é exibido em destaque acima.
  const registrosAnteriores = historico.filter((contrato) => contrato.id !== contratoAtual?.id)

  return (
    <div className="space-y-6">
      {/* Barra superior: voltar + ações (fora do card) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BotaoVoltar href="/clientes" label="Clientes" />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/clientes/${id}/editar`}>
              <Pencil className="size-4" />
              Editar cliente
            </Link>
          </Button>
        </div>
      </div>

      {/* Header rico em card (mockup modelo_cliente_novo) */}
      <Card>
        <CardContent className="flex flex-col gap-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <LogoClienteUpload
              clienteId={id}
              nome={cliente.nome}
              logoUrl={cliente.logoUrl}
              iniciais={iniciaisDoNome(cliente.nome)}
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl leading-tight font-semibold tracking-tight">
                  {cliente.nome}
                </h1>
                <Badge
                  style={{ backgroundColor: STATUS_COLOR[cliente.status] }}
                  className="text-white"
                >
                  {STATUS_LABEL[cliente.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {cliente.segmento ?? NICHO_LABEL[cliente.nicho]}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
                {cliente.contatoTelefone &&
                  (() => {
                    const digitos = cliente.contatoTelefone.replace(/\D/g, '')
                    const temWhats = digitos.length === 10 || digitos.length === 11
                    const texto = formatarTelefoneExibicao(cliente.contatoTelefone)
                    return temWhats ? (
                      <a
                        href={`https://wa.me/55${digitos}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir conversa no WhatsApp"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground hover:underline"
                      >
                        <Phone className="size-4" />
                        {texto}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-4" />
                        {texto}
                      </span>
                    )
                  })()}
                {cliente.contatoEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-4" />
                    {cliente.contatoEmail}
                  </span>
                )}
                {cliente.instagram && (
                  <span className="flex items-center gap-1.5">
                    <InstagramLogo className="size-4" />
                    {cliente.instagram}
                  </span>
                )}
                {(cliente.cidade || cliente.estado) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {[cliente.cidade, cliente.estado].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Colunas de resumo (mockup) — divisores verticais, só em telas grandes */}
          <div className="hidden shrink-0 lg:flex lg:items-center">
            <div className="space-y-1 border-l pl-6 pr-6">
              <p className="text-xs text-muted-foreground">Cliente desde</p>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays className="size-4 text-muted-foreground" />
                {format(cliente.createdAt, 'dd/MM/yyyy')}
              </p>
            </div>
            <div className="space-y-1 border-l pl-6 pr-6">
              <p className="text-xs text-muted-foreground">Responsável</p>
              {gestorNome ? (
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Avatar className="size-6">
                    {gestorFoto && <AvatarImage src={gestorFoto} alt={gestorNome} />}
                    <AvatarFallback className="text-[10px]">
                      {iniciaisDoNome(gestorNome)}
                    </AvatarFallback>
                  </Avatar>
                  {gestorNome}
                </span>
              ) : (
                <p className="text-sm font-medium">—</p>
              )}
            </div>
            <div className="space-y-1 border-l pl-6 pr-6">
              <p className="text-xs text-muted-foreground">Plano</p>
              {planoLabel ? (
                <Badge variant="secondary">{planoLabel}</Badge>
              ) : (
                <p className="text-sm font-medium">—</p>
              )}
            </div>
            <div className="space-y-1 border-l pl-6">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge
                style={{ backgroundColor: STATUS_COLOR[cliente.status] }}
                className="text-white"
              >
                {STATUS_LABEL[cliente.status]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Corpo em abas */}
      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="visao-geral">🏠 Visão geral</TabsTrigger>
          <TabsTrigger value="alertas">
            🔔 Alertas{alertas.length > 0 && ` (${alertas.length})`}
          </TabsTrigger>
          <TabsTrigger value="financeiro">💰 Financeiro</TabsTrigger>
          <TabsTrigger value="contas">📊 Contas de anúncio</TabsTrigger>
          <TabsTrigger value="tarefas">
            🗒️ Tarefas{tarefasFicha.abertas.length > 0 && ` (${tarefasFicha.abertas.length})`}
          </TabsTrigger>
          <TabsTrigger value="processos">
            {cliente.status === 'em_aviso' ? '🚨' : '🔄'} Processos
          </TabsTrigger>
          <TabsTrigger value="documentos">📎 Documentos</TabsTrigger>
        </TabsList>

        {/* Aba: Visão geral (dados REAIS já carregados) */}
        <TabsContent value="visao-geral" className="space-y-4">
          <VisaoGeralCliente
            cliente={cliente}
            clienteId={id}
            segmentoLabel={cliente.segmento ?? NICHO_LABEL[cliente.nicho]}
            gestorNome={gestorNome}
            gestorFoto={gestorFoto}
            servicos={servicos}
            contratoAtual={contratoAtual}
            historico={historico}
            contas={contasDoCliente}
            acompanhamentos={acompanhamentos}
            tarefasAbertas={tarefasFicha.abertas}
            documentos={docsCliente}
          />
        </TabsContent>

        {/* Aba: Alertas (notificações do cliente, antes empilhadas no topo) */}
        <TabsContent value="alertas" className="space-y-3">
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum alerta ativo para este cliente.
            </p>
          ) : (
            alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`rounded-lg border border-l-4 bg-secondary/40 p-3 ${SEVERIDADE_BORDA[alerta.severidade]}`}
              >
                <p className="text-sm font-medium">{alerta.titulo}</p>
                <p className="text-sm text-muted-foreground">{alerta.detalhe}</p>
              </div>
            ))
          )}
        </TabsContent>

        {/* Aba: Financeiro — contrato + cobrança + faturas (dados REAIS) */}
        <TabsContent value="financeiro" className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] leading-tight font-semibold">Contrato Atual</h2>
              {contratoAtual && <Badge variant="outline">Contrato Atual</Badge>}
            </div>

            {contratoAtual ? (
              <>
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

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ContratoForm
                      clienteId={id}
                      contratoId={contratoAtual.id}
                      defaultValues={{
                        dataInicio: contratoAtual.dataInicio,
                        dataVencimento: contratoAtual.dataVencimento,
                        valorMensal: Number(contratoAtual.valorMensal),
                      }}
                      triggerLabel="Editar contrato"
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
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
                            {'Esta ação não pode ser desfeita. Este registro de contrato será removido permanentemente. Deseja continuar?'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <form action={excluirContratoAction.bind(null, contratoAtual.id)}>
                            <AlertDialogAction type="submit" variant="destructive">
                              Excluir contrato
                            </AlertDialogAction>
                          </form>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
            )}

            <div className="border-t pt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Renovou ou fechou um novo contrato? Registre abaixo — o atual vai para o histórico.
              </p>
              <ContratoForm clienteId={id} />
            </div>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <ContratoForm
                          clienteId={id}
                          contratoId={contrato.id}
                          defaultValues={{
                            dataInicio: contrato.dataInicio,
                            dataVencimento: contrato.dataVencimento,
                            valorMensal: Number(contrato.valorMensal),
                          }}
                          triggerLabel="Editar"
                          triggerVariant="outline"
                          triggerSize="sm"
                        />
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
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-[20px] leading-tight font-semibold">💳 Cobrança</h2>
            <CobrancaCliente clienteId={id} modoCobranca={cliente.modoCobranca} cobrancas={cobrancas} />
          </section>

          <section className="space-y-4 border-t pt-6">
            <h2 className="text-[20px] leading-tight font-semibold">Faturas</h2>
            <FaturasCliente
              clienteId={id}
              modoCobranca={cliente.modoCobranca}
              faturas={faturas}
              asaasConfigurado={asaasConfigurado}
            />
          </section>
        </TabsContent>

        {/* Aba: Contas de anúncio (dados REAIS) */}
        <TabsContent value="contas" className="space-y-4">
          <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
            <MetasCliente
              clienteId={id}
              metaCpa={cliente.metaCpa}
              metaCpl={cliente.metaCpl}
              metaRoas={cliente.metaRoas}
              heroiLabel={heroiDoObjetivo(cliente.objetivoPrincipal, cliente.nicho).label}
            />
          </section>

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

        {/* Aba: Tarefas do cliente (dados REAIS — tabela tarefas) */}
        <TabsContent value="tarefas" className="space-y-4">
          <TarefasCliente abertas={tarefasFicha.abertas} historico={tarefasFicha.historico} />
        </TabsContent>

        {/* Aba: Processos — Onboarding + Retenção + Saída (fluxos guiados) */}
        <TabsContent value="processos" className="space-y-4">
          <OnboardingCliente clienteId={cliente.id} processo={processoOnboarding} />
          <RetencaoCliente
            clienteId={cliente.id}
            clienteNome={cliente.nome}
            emAtencao={cliente.status === 'em_aviso'}
            motivoAtencao={cliente.motivoAtencao}
            processo={processoRetencao}
          />
          <SaidaCliente
            clienteId={cliente.id}
            encerrado={cliente.status === 'encerrado'}
            motivoEncerramento={cliente.motivoEncerramento}
            processo={processoSaida}
          />
        </TabsContent>

        {/* Aba: Documentos */}
        <TabsContent value="documentos" className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
            <h2 className="text-[20px] leading-tight font-semibold">Enviar documento</h2>
            <UploadDocumento clienteId={id} />
          </section>

          <section className="space-y-4">
            <h2 className="text-[20px] leading-tight font-semibold">Documentos do cliente</h2>
            <DocumentosLista documentos={docsCliente} />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
