// Aba "Visão geral" da ficha do cliente (quick-260723-v8z).
// Server Component puro: recebe TUDO por props (sem 'use client', sem queries
// próprias). Reproduz o mockup modelo_cliente_novo.png com dados REAIS já
// carregados na page — nenhum dado inventado.

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  Pencil,
  Plus,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AcompanhamentoForm } from '@/components/ficha/acompanhamento-form'
import {
  GoogleAdsLogo,
  InstagramLogo,
  MetaLogo,
} from '@/components/ficha/brand-logos'
import type { ContaDoCliente } from '@/actions/trafego'
import type { AcompanhamentoDb } from '@/actions/acompanhamento'
import type { TarefaFicha } from '@/lib/tarefas/ficha-cliente'
import type { clientes } from '@/lib/db/schema'

type Cliente = typeof clientes.$inferSelect

type DocumentoFicha = {
  id: string
  nome: string
  categoria: string | null
  createdAt: Date
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

// Paleta cíclica das badges de tag (mockup: tags coloridas suaves).
const TAG_CORES = [
  'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
]

function formatarData(data: string): string {
  return format(parseISO(data), 'dd/MM/yyyy')
}

function formatarDataHora(data: Date): string {
  return format(data, "dd/MM/yyyy 'às' HH:mm")
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return [partes[0], partes[partes.length - 1]]
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

function comProtocolo(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// Cabeçalho de card com título à esquerda e ação opcional à direita.
function TituloCard({
  titulo,
  acao,
}: {
  titulo: string
  acao?: React.ReactNode
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-base">{titulo}</CardTitle>
      {acao}
    </CardHeader>
  )
}

// Rodapé "Ver todos" clicável (link para a página/aba correspondente).
function RodapeVerTodos({ href, label }: { href: string; label: string }) {
  return (
    <div className="border-t px-6 py-2.5">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="w-full text-primary hover:text-primary"
      >
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  )
}

// Link "Acessar ↗" das linhas de acesso.
function LinkAcessar({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      Acessar
      <ExternalLink className="size-3.5" />
    </a>
  )
}

export function VisaoGeralCliente({
  cliente,
  clienteId,
  segmentoLabel,
  gestorNome,
  gestorFoto,
  servicos,
  contratoAtual,
  historico,
  contas,
  acompanhamentos,
  tarefasAbertas,
  documentos,
}: {
  cliente: Cliente
  clienteId: string
  segmentoLabel: string
  gestorNome: string | null
  gestorFoto: string | null
  servicos: string[]
  contratoAtual: { valorMensal: string; dataInicio: string } | null
  historico: { id: string; dataInicio: string }[]
  contas: ContaDoCliente[]
  acompanhamentos: AcompanhamentoDb[]
  tarefasAbertas: TarefaFicha[]
  documentos: DocumentoFicha[]
}) {
  // ---- Dados de cadastro (só linhas reais preenchidas) ----
  const servicosLabels = servicos
    .map((s) => SERVICO_LABELS[s] ?? s)
    .filter(Boolean)

  // Pastas do Drive nomeadas (jsonb [{nome, url}]).
  const pastas = Array.isArray(cliente.pastas)
    ? (cliente.pastas as { nome?: string; url?: string }[]).filter((p) => p?.nome && p?.url)
    : []

  // Tags livres do cliente (jsonb array de strings).
  const tags = Array.isArray(cliente.tags)
    ? (cliente.tags as unknown[]).filter((t): t is string => typeof t === 'string' && t !== '')
    : []

  const dados: { label: string; valor: string }[] = []
  dados.push({ label: 'Segmento', valor: segmentoLabel })
  if (cliente.principalServico)
    dados.push({ label: 'Principal serviço', valor: cliente.principalServico })
  if (cliente.ticketMedio)
    dados.push({ label: 'Ticket médio', valor: formatadorMoeda.format(Number(cliente.ticketMedio)) })
  if (cliente.verbaMensal)
    dados.push({ label: 'Verba mensal', valor: formatadorMoeda.format(Number(cliente.verbaMensal)) })
  if (contratoAtual)
    dados.push({
      label: 'Valor mensal',
      valor: formatadorMoeda.format(Number(contratoAtual.valorMensal)),
    })
  if (cliente.objetivoPrincipal)
    dados.push({ label: 'Objetivo principal', valor: cliente.objetivoPrincipal })
  if (cliente.origemCliente)
    dados.push({ label: 'Como nos conheceu?', valor: cliente.origemCliente })
  dados.push({ label: 'Data de cadastro', valor: format(cliente.createdAt, 'dd/MM/yyyy') })

  // ---- Acessos e contas (contas de anúncio + instagram + site) ----
  type Acesso = { key: string; logo: React.ReactNode; nome: string; sub: string; href: string }
  const acessos: Acesso[] = []
  for (const conta of contas) {
    const idLimpo = conta.metaAccountId.replace(/^act_/, '')
    if (conta.plataforma === 'meta') {
      acessos.push({
        key: conta.id,
        logo: <MetaLogo className="size-9 shrink-0" />,
        nome: conta.nome,
        sub: `Conta ID: ${conta.metaAccountId}`,
        href: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${idLimpo}`,
      })
    } else {
      acessos.push({
        key: conta.id,
        logo: <GoogleAdsLogo className="size-9 shrink-0" />,
        nome: conta.nome,
        sub: `Conta ID: ${conta.metaAccountId}`,
        href: 'https://ads.google.com/aw/campaigns',
      })
    }
  }
  if (cliente.instagram) {
    acessos.push({
      key: 'instagram',
      logo: <InstagramLogo className="size-9 shrink-0" />,
      nome: 'Instagram',
      sub: cliente.instagram,
      href: `https://instagram.com/${cliente.instagram.replace(/^@/, '')}`,
    })
  }
  if (cliente.siteUrl) {
    acessos.push({
      key: 'site',
      logo: (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Globe className="size-5 text-muted-foreground" />
        </div>
      ),
      nome: 'Site',
      sub: cliente.siteUrl.replace(/^https?:\/\//i, ''),
      href: comProtocolo(cliente.siteUrl),
    })
  }

  // ---- Relacionamentos (gestor + autores de acompanhamento) ----
  type Pessoa = { nome: string; papel: string; foto: string | null }
  const pessoas: Pessoa[] = []
  if (gestorNome)
    pessoas.push({ nome: gestorNome, papel: 'Gestor responsável', foto: gestorFoto })
  const vistos = new Set(pessoas.map((p) => p.nome))
  for (const a of acompanhamentos) {
    if (pessoas.length >= 4) break
    if (!vistos.has(a.autorNome)) {
      vistos.add(a.autorNome)
      pessoas.push({ nome: a.autorNome, papel: 'Atendimento', foto: null })
    }
  }

  // ---- Atividades recentes / próximas ----
  const atividades = acompanhamentos.slice(0, 5)
  const proximas = tarefasAbertas.slice(0, 5)
  const docsRecentes = documentos.slice(0, 4)

  // ---- Histórico do cliente (marcos reais) ----
  const marcos: { label: string; data: string }[] = [
    { label: 'Cliente criado', data: format(cliente.createdAt, 'dd/MM/yyyy') },
    ...[...historico]
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
      .map((c) => ({ label: 'Contrato iniciado', data: formatarData(c.dataInicio) })),
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ===== Coluna 1 ===== */}
        <div className="space-y-4">
          {/* Dados de cadastro */}
          <Card>
            <TituloCard titulo="Dados de cadastro" />
            <CardContent className="space-y-2.5">
              {dados.map((d) => (
                <div key={d.label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="text-right font-medium">{d.valor}</span>
                </div>
              ))}
              {tags.length > 0 && (
                <div className="flex items-start gap-4 pt-2 text-sm">
                  <span className="shrink-0 text-muted-foreground">Tags</span>
                  <div className="flex flex-1 flex-wrap justify-end gap-1.5">
                    {tags.map((tag, i) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className={`font-normal ${TAG_CORES[i % TAG_CORES.length]}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {servicosLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {servicosLabels.map((label) => (
                    <Badge key={label} variant="secondary" className="font-normal">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <TituloCard
              titulo="Observações"
              acao={
                <Button asChild variant="ghost" size="icon" className="size-7">
                  <Link href={`/clientes/${clienteId}/editar`}>
                    <Pencil className="size-4 text-muted-foreground" />
                  </Link>
                </Button>
              }
            />
            <CardContent className="space-y-3">
              {cliente.notas ? (
                <>
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-sm whitespace-pre-wrap">{cliente.notas}</p>
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>Responsável: {gestorNome ?? '—'}</p>
                    <p>Última atualização: {formatarDataHora(cliente.updatedAt)}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem observações registradas.</p>
              )}
            </CardContent>
          </Card>

          {/* Relacionamentos */}
          <Card>
            <TituloCard titulo="Relacionamentos" />
            <CardContent>
              <div className="flex flex-wrap gap-6">
                {pessoas.map((p) => (
                  <div key={p.nome} className="flex flex-col items-center gap-1.5 text-center">
                    <Avatar className="size-11">
                      {p.foto && <AvatarImage src={p.foto} alt={p.nome} />}
                      <AvatarFallback className="text-sm">{iniciais(p.nome)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-tight">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.papel}</p>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Avatar className="size-11 border border-dashed bg-transparent">
                    <AvatarFallback className="bg-transparent">
                      <Plus className="size-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-muted-foreground">Adicionar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== Coluna 2 ===== */}
        <div className="space-y-4">
          {/* Acessos e contas */}
          <Card className="overflow-hidden pb-0">
            <TituloCard titulo="Acessos e contas" />
            <CardContent className="space-y-3.5 pb-4">
              {acessos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum acesso cadastrado.</p>
              ) : (
                acessos.map((a) => (
                  <div key={a.key} className="flex items-center gap-3">
                    {a.logo}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                    <LinkAcessar href={a.href} />
                  </div>
                ))
              )}
            </CardContent>
            <RodapeVerTodos href="/integracoes" label="Ver todas integrações" />
          </Card>

          {/* Atividades recentes */}
          <Card className="overflow-hidden pb-0">
            <TituloCard titulo="Atividades recentes" />
            <CardContent className="space-y-3 pb-4">
              {atividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
              ) : (
                atividades.map((registro) => (
                  <div key={registro.id} className="flex gap-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {iniciais(registro.autorNome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{registro.nota}</p>
                      <p className="text-xs text-muted-foreground">
                        por {registro.autorNome} · {formatarDataHora(registro.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Registrar interação
                </p>
                <AcompanhamentoForm clienteId={clienteId} />
              </div>
            </CardContent>
            <RodapeVerTodos href="/acompanhamento" label="Ver todas atividades" />
          </Card>
        </div>

        {/* ===== Coluna 3 ===== */}
        <div className="space-y-4">
          {/* Pastas e documentos */}
          <Card className="overflow-hidden pb-0">
            <TituloCard titulo="Pastas e documentos" />
            <CardContent className="space-y-3 pb-4">
              {cliente.linkDrive && (
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20">
                    <Folder className="size-5 fill-amber-400 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Pasta do Drive</p>
                    <p className="truncate text-xs text-muted-foreground">Arquivos da agência</p>
                  </div>
                  <LinkAcessar href={comProtocolo(cliente.linkDrive)} />
                </div>
              )}
              {pastas.map((pasta, i) => (
                <div key={`${pasta.nome}-${i}`} className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20">
                    <Folder className="size-5 fill-amber-400 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pasta.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">Drive da agência</p>
                  </div>
                  <LinkAcessar href={comProtocolo(pasta.url!)} />
                </div>
              ))}
              {docsRecentes.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.categoria ?? 'Documento'} · {format(doc.createdAt, 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              ))}
              {!cliente.linkDrive && pastas.length === 0 && docsRecentes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma pasta cadastrada.</p>
              )}
            </CardContent>
            <RodapeVerTodos href={`/clientes/${clienteId}/editar`} label="Gerenciar pastas" />
          </Card>

          {/* Próximas atividades */}
          <Card className="overflow-hidden pb-0">
            <TituloCard titulo="Próximas atividades" />
            <CardContent className="space-y-3 pb-4">
              {proximas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa em aberto.</p>
              ) : (
                proximas.map((tarefa) => (
                  <div key={tarefa.id} className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <CalendarClock className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tarefa.titulo}</p>
                      {tarefa.subtitulo && (
                        <p className="truncate text-xs text-muted-foreground">{tarefa.subtitulo}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatarData(tarefa.data)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
            <RodapeVerTodos href="/tarefas" label="Ver todas tarefas" />
          </Card>
        </div>
      </div>

      {/* ===== Rodapé: Histórico do cliente ===== */}
      <Card>
        <TituloCard titulo="Histórico do cliente" />
        <CardContent>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {marcos.map((marco, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-chart-success" />
                <div>
                  <p className="text-sm font-medium">{marco.label}</p>
                  <p className="text-xs text-muted-foreground">{marco.data}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
