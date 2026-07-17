'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Handshake,
  Inbox,
  Package,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Trophy,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  atualizarAtendenteLead,
  atualizarFotoLead,
  atualizarLead,
  excluirLead,
  getFichaLead,
  renomearLead,
  salvarNotasLead,
  salvarProdutosNegocio,
} from '@/actions/crm-lead'
import { desvincularTagLead, vincularTagLead } from '@/actions/crm-tags'
import { concluirAtividadeCrm } from '@/actions/crm-atividades'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { BotaoVoltar } from '@/components/ui/botao-voltar'
import { CriarAtividadeDialog } from '@/components/crm/criar-atividade-dialog'
import { TagsSelect } from '@/components/crm/tags-select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { mascararDocumento, mascararTelefone } from '@/lib/crm/mascaras'
import { nomeOrigem } from '@/lib/crm/origem'
import { extrairDetalheLead } from '@/lib/crm/normalizar-entrada'
import { rotuloServico, SERVICOS_JSR, type ServicoJsr } from '@/lib/crm/servicos'
import { classesCorTag } from '@/lib/crm/tags'
import { tempoRelativoCurto } from '@/lib/crm/tempo'
import { cn } from '@/lib/utils'
import { leadPerfilSchema, ORIGENS_LEAD } from '@/lib/validations/crm'

// Ficha COMPLETA do lead (imagens 04-06): painel ESQUERDO com foto (upload
// real), nome inline, tags, atendente, Metricas/Notas recolhiveis e as abas
// Perfil/Endereco/Campos adicionais; painel DIREITO com Historico (timeline),
// Atividades (agendaveis) e Informacoes do Negocio (cards + Pipeline Completa).
// Um lead tem N negocios (D-02) — a ficha e a PESSOA.
//
// Sem placeholders falsos de proposito: nada de Produtos e Valores (nao existe
// catalogo), automacao ou anexos.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Ficha = NonNullable<Awaited<ReturnType<typeof getFichaLead>>['data']>

const ROTULO_ATIVIDADE: Record<string, string> = {
  criacao: 'Negocio criado',
  contato_criado: 'Lead cadastrado',
  mudanca_etapa: 'Mudou de etapa',
  ganho: 'Negocio ganho',
  perda: 'Negocio perdido',
  reabertura: 'Negocio reaberto',
  lead_recebido: 'Lead recebido',
  tarefa_criada: 'Atividade criada',
  tarefa_concluida: 'Atividade concluida',
  tag_adicionada: 'Tag adicionada',
  tag_removida: 'Tag removida',
}

const ICONE_ATIVIDADE: Record<string, LucideIcon> = {
  criacao: Handshake,
  contato_criado: UserPlus,
  mudanca_etapa: ArrowRightLeft,
  ganho: Trophy,
  perda: XCircle,
  reabertura: ArrowRightLeft,
  lead_recebido: Inbox,
  tarefa_criada: Plus,
  tarefa_concluida: CheckCircle2,
  tag_adicionada: Tag,
  tag_removida: Tag,
}

const ROTULO_TIPO_TAREFA: Record<string, string> = {
  ligacao: 'Ligacao',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reuniao',
  followup: 'Follow-up',
  outro: 'Outro',
}

const CLASSE_PRIORIDADE: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  alta: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const ROTULO_PRIORIDADE: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Media',
  alta: 'Alta',
}

function formatarDia(iso: string): string {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${d.getFullYear()}`
}

function formatarHora(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Agrupa itens por dia (dd/MM/yyyy) preservando a ordem de chegada. */
function agruparPorDia<T>(itens: T[], dataDe: (item: T) => string): [string, T[]][] {
  const grupos = new Map<string, T[]>()
  for (const item of itens) {
    const dia = formatarDia(dataDe(item))
    const lista = grupos.get(dia)
    if (lista) lista.push(item)
    else grupos.set(dia, [item])
  }
  return [...grupos.entries()]
}

/** Secao recolhivel do painel esquerdo (Metricas/Notas) — chevron gira. */
function SecaoRecolhivel({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  const [aberta, setAberta] = useState(true)
  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold hover:bg-accent/40"
      >
        {titulo}
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', !aberta && '-rotate-90')}
        />
      </button>
      {aberta && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export function FichaLead({
  contatoId,
  onOpenChange,
}: {
  contatoId: string | null // null = fechada
  onOpenChange: (aberta: boolean) => void
}) {
  const router = useRouter()
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Painel esquerdo — estados locais de edicao.
  const [editandoNome, setEditandoNome] = useState(false)
  const [nomeRascunho, setNomeRascunho] = useState('')
  const [mostrarTags, setMostrarTags] = useState(false)
  const [notasRascunho, setNotasRascunho] = useState('')
  const [salvandoNotas, setSalvandoNotas] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  // Painel direito.
  const [modalAtividade, setModalAtividade] = useState(false)
  const [negocioSelecionado, setNegocioSelecionado] = useState<string | null>(null)

  // Produtos e Valores (imagem04): adicionar produto + editar valor inline.
  const [novoProdutoServico, setNovoProdutoServico] = useState<ServicoJsr | ''>('')
  const [novoProdutoValor, setNovoProdutoValor] = useState('')
  const [salvandoProduto, setSalvandoProduto] = useState(false)
  const [valoresRascunho, setValoresRascunho] = useState<Record<string, string>>({})

  // Exclusao do lead (acao destrutiva com confirmacao).
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const { register, handleSubmit, reset, setValue, watch } = useForm<
    z.input<typeof leadPerfilSchema>,
    unknown,
    z.output<typeof leadPerfilSchema>
  >({
    resolver: zodResolver(leadPerfilSchema),
  })

  const carregar = useCallback(
    async (id: string, silencioso = false) => {
      if (!silencioso) {
        setCarregando(true)
        setErro(null)
      }
      const result = await getFichaLead(id)
      if ('error' in result) {
        setErro(result.error ?? 'Nao foi possivel carregar a ficha do lead.')
        setFicha(null)
      } else if (result.data) {
        setFicha(result.data)
        const p = result.data.perfil
        setNomeRascunho(p.nome)
        setNotasRascunho(p.notas ?? '')
        // Negocio padrao da aba Informacoes: o mais recente ABERTO (fallback:
        // o mais recente de todos).
        const aberto = result.data.negocios.find((n) => n.status === 'aberta')
        setNegocioSelecionado(aberto?.id ?? result.data.negocios[0]?.id ?? null)
        // Inputs controlados nao aceitam null: '' e o vazio do form.
        reset({
          nome: p.nome,
          email: p.email ?? '',
          telefone: p.telefone ?? '',
          documento: p.documento ?? '',
          site: p.site ?? '',
          cargo: p.cargo ?? '',
          dataNascimento: p.dataNascimento ?? '',
          cep: p.cep ?? '',
          endereco: p.endereco ?? '',
          pais: p.pais ?? '',
          numero: p.numero ?? '',
          complemento: p.complemento ?? '',
          bairro: p.bairro ?? '',
          cidade: p.cidade ?? '',
          estado: p.estado ?? '',
          notas: p.notas ?? '',
          origem: (p.origem as (typeof ORIGENS_LEAD)[number]) ?? 'manual',
        })
      }
      if (!silencioso) setCarregando(false)
    },
    [reset]
  )

  useEffect(() => {
    // contatoId null = fechada: nao carrega nada.
    if (!contatoId) {
      setEditandoNome(false)
      setMostrarTags(false)
      return
    }
    void carregar(contatoId)
  }, [contatoId, carregar])

  const telefone = watch('telefone') ?? ''
  const documento = watch('documento') ?? ''
  const origem = watch('origem')

  function onSubmit(values: z.output<typeof leadPerfilSchema>) {
    if (!contatoId) return
    startTransition(async () => {
      const result = await atualizarLead(contatoId, values)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel salvar o lead.')
        return
      }
      toast.success('Lead atualizado.')
      void carregar(contatoId, true)
      router.refresh()
    })
  }

  // --- Foto (lapis sobre o avatar) ---
  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (!file || !contatoId) return
    setEnviandoFoto(true)
    const fd = new FormData()
    fd.set('file', file)
    const result = await atualizarFotoLead(contatoId, fd)
    setEnviandoFoto(false)
    if ('error' in result) {
      toast.error(result.error ?? 'Nao foi possivel enviar a foto.')
      return
    }
    toast.success('Foto atualizada.')
    if (result.data) {
      setFicha((atual) =>
        atual ? { ...atual, perfil: { ...atual.perfil, fotoUrl: result.data.fotoUrl } } : atual
      )
    }
    router.refresh()
  }

  // --- Nome inline ---
  async function salvarNome() {
    if (!contatoId || !ficha) return
    const limpo = nomeRascunho.trim()
    setEditandoNome(false)
    if (!limpo || limpo === ficha.perfil.nome) {
      setNomeRascunho(ficha.perfil.nome)
      return
    }
    const result = await renomearLead(contatoId, limpo)
    if ('error' in result) {
      toast.error(result.error ?? 'Nao foi possivel renomear o lead.')
      setNomeRascunho(ficha.perfil.nome)
      return
    }
    setFicha((atual) =>
      atual ? { ...atual, perfil: { ...atual.perfil, nome: limpo } } : atual
    )
    setValue('nome', limpo)
    router.refresh()
  }

  // --- Tags (diff do TagsSelect → vincular/desvincular) ---
  async function aoMudarTags(novas: string[]) {
    if (!contatoId || !ficha) return
    const atuais = ficha.tags.map((t) => t.id)
    const adicionada = novas.find((id) => !atuais.includes(id))
    const removida = atuais.find((id) => !novas.includes(id))
    // O TagsSelect alterna UMA tag por clique: trata um evento por vez.
    if (adicionada) {
      const result = await vincularTagLead(contatoId, adicionada)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel adicionar a tag.')
        return
      }
    } else if (removida) {
      const result = await desvincularTagLead(contatoId, removida)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel remover a tag.')
        return
      }
    }
    void carregar(contatoId, true)
    router.refresh()
  }

  // --- Atendente ---
  function aoTrocarAtendente(valor: string) {
    if (!contatoId) return
    const donoId = valor === 'nenhum' ? null : valor
    startTransition(async () => {
      const result = await atualizarAtendenteLead(contatoId, donoId)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel trocar o atendente.')
        return
      }
      toast.success('Atendente atualizado.')
      void carregar(contatoId, true)
      router.refresh()
    })
  }

  // --- Notas (salva no blur) ---
  async function salvarNotas() {
    if (!contatoId || !ficha) return
    if ((ficha.perfil.notas ?? '') === notasRascunho.trim()) return
    setSalvandoNotas(true)
    const result = await salvarNotasLead(contatoId, notasRascunho)
    setSalvandoNotas(false)
    if ('error' in result) {
      toast.error(result.error ?? 'Nao foi possivel salvar as notas.')
      return
    }
    setFicha((atual) =>
      atual
        ? { ...atual, perfil: { ...atual.perfil, notas: notasRascunho.trim() || null } }
        : atual
    )
  }

  // --- Atividades ---
  function concluirAtividade(id: string) {
    if (!contatoId) return
    startTransition(async () => {
      const result = await concluirAtividadeCrm(id)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel concluir a atividade.')
        return
      }
      toast.success('Atividade concluida.')
      void carregar(contatoId, true)
      router.refresh()
    })
  }

  function copiarTelefone() {
    if (!telefone) return
    void navigator.clipboard.writeText(telefone).then(() => toast.success('Telefone copiado.'))
  }

  // --- Produtos e Valores ---
  // Produtos vivem DENTRO do negocio selecionado (jsonb, migration 0026).
  // Adicionar/remover produto NAO cria nem apaga card no kanban — corrige o bug
  // em que adicionar servico "criava outro lead" e excluir o unico produto
  // "apagava o lead" do quadro (16/jul/2026).

  /** Lista de produtos do negocio: jsonb novo, ou fallback legado {servico, valor}. */
  function produtosDoNegocio(n: Ficha['negocios'][number] | null): { servico: string; valor: number | null }[] {
    if (!n) return []
    if (Array.isArray(n.produtos)) {
      return (n.produtos as { servico?: unknown; valor?: unknown }[])
        .filter((p) => typeof p?.servico === 'string')
        .map((p) => ({
          servico: p.servico as string,
          valor: typeof p.valor === 'number' && Number.isFinite(p.valor) ? p.valor : null,
        }))
    }
    return n.servico ? [{ servico: n.servico, valor: n.valor }] : []
  }

  async function salvarProdutos(novos: { servico: string; valor: number | null }[]) {
    if (!contatoId || !negocioSelecionado) return
    const result = await salvarProdutosNegocio(negocioSelecionado, novos)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    setValoresRascunho({})
    await carregar(contatoId, true)
    router.refresh()
  }

  async function adicionarProduto() {
    if (!negocioSelecionado || !novoProdutoServico) {
      toast.error('Escolha o produto/servico.')
      return
    }
    const valorNum = novoProdutoValor.trim() ? Number(novoProdutoValor.replace(',', '.')) : null
    if (valorNum !== null && (!Number.isFinite(valorNum) || valorNum < 0)) {
      toast.error('Valor invalido.')
      return
    }
    setSalvandoProduto(true)
    try {
      const atuais = produtosDoNegocio(ficha?.negocios.find((n) => n.id === negocioSelecionado) ?? null)
      await salvarProdutos([...atuais, { servico: novoProdutoServico, valor: valorNum }])
      toast.success('Produto adicionado.')
      setNovoProdutoServico('')
      setNovoProdutoValor('')
    } finally {
      setSalvandoProduto(false)
    }
  }

  async function salvarValorProduto(indice: number) {
    const rascunho = valoresRascunho[String(indice)]
    if (rascunho === undefined) return
    const valorNum = rascunho.trim() ? Number(rascunho.replace(',', '.')) : null
    if (valorNum !== null && (!Number.isFinite(valorNum) || valorNum < 0)) {
      toast.error('Valor invalido.')
      return
    }
    const atuais = produtosDoNegocio(ficha?.negocios.find((n) => n.id === negocioSelecionado) ?? null)
    if (!atuais[indice]) return
    const novos = atuais.map((p, i) => (i === indice ? { ...p, valor: valorNum } : p))
    await salvarProdutos(novos)
  }

  async function excluirProduto(indice: number) {
    const atuais = produtosDoNegocio(ficha?.negocios.find((n) => n.id === negocioSelecionado) ?? null)
    const novos = atuais.filter((_, i) => i !== indice)
    await salvarProdutos(novos)
    toast.success('Produto removido.')
  }

  async function confirmarExcluirLead() {
    if (!contatoId) return
    setExcluindo(true)
    try {
      const result = await excluirLead(contatoId)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Lead excluido.')
      setConfirmarExclusao(false)
      onOpenChange(false)
      router.refresh()
    } finally {
      setExcluindo(false)
    }
  }

  const negocio = ficha?.negocios.find((n) => n.id === negocioSelecionado) ?? null
  // Etapas do pipeline do negocio selecionado (Pipeline Completa).
  const etapasDoNegocio = negocio
    ? (ficha?.etapas ?? []).filter((e) => e.pipelineId === negocio.pipelineId)
    : []

  const inicial = (ficha?.perfil.nome ?? '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <Sheet open={contatoId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* Titulo acessivel (a UI mostra o nome no painel esquerdo). */}
        <SheetTitle className="sr-only">
          {ficha?.perfil.nome ?? 'Ficha do lead'}
        </SheetTitle>

        {carregando && (
          <div className="space-y-3 p-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!carregando && erro && <p className="p-6 text-sm text-destructive">{erro}</p>}

        {!carregando && !erro && ficha && (
          <div className="flex h-full min-h-0 flex-col overflow-y-auto md:grid md:grid-cols-[340px_1fr] md:overflow-visible">
            {/* ============ PAINEL ESQUERDO ============ */}
            <div className="border-b md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r">
              {/* Voltar: fecha a ficha e retorna ao Kanban/Lista do CRM. */}
              <div className="px-2 pt-2">
                <BotaoVoltar label="Voltar" onClick={() => onOpenChange(false)} />
              </div>
              {/* Faixa suave + avatar grande com o lapis de upload. */}
              <div className="bg-gradient-to-b from-emerald-100/80 to-transparent px-4 pt-8 pb-2 text-center dark:from-emerald-950/40">
                <div className="relative mx-auto size-24">
                  {ficha.perfil.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL publica do Supabase Storage; next/image exigiria configurar dominio remoto
                    <img
                      src={ficha.perfil.fotoUrl}
                      alt={`Foto de ${ficha.perfil.nome}`}
                      className="size-24 rounded-full border-2 border-background object-cover shadow"
                    />
                  ) : (
                    <span className="flex size-24 items-center justify-center rounded-full border-2 border-background bg-emerald-200 text-3xl font-semibold text-emerald-700 shadow dark:bg-emerald-900 dark:text-emerald-200">
                      {inicial}
                    </span>
                  )}
                  <button
                    type="button"
                    title="Trocar foto do lead"
                    aria-label="Trocar foto do lead"
                    disabled={enviandoFoto}
                    onClick={() => inputFotoRef.current?.click()}
                    className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <input
                    ref={inputFotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={aoEscolherFoto}
                  />
                </div>
                {enviandoFoto && (
                  <p className="mt-1 text-[10px] text-muted-foreground">Enviando foto...</p>
                )}

                {/* Nome com edicao inline: clique vira Input. */}
                {editandoNome ? (
                  <Input
                    autoFocus
                    value={nomeRascunho}
                    onChange={(e) => setNomeRascunho(e.target.value)}
                    onBlur={() => void salvarNome()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void salvarNome()
                      if (e.key === 'Escape') {
                        setNomeRascunho(ficha.perfil.nome)
                        setEditandoNome(false)
                      }
                    }}
                    className="mx-auto mt-2 h-8 max-w-56 text-center text-base font-semibold"
                  />
                ) : (
                  <button
                    type="button"
                    title="Clique para renomear"
                    onClick={() => setEditandoNome(true)}
                    className="mt-2 w-full truncate text-lg font-semibold hover:underline"
                  >
                    {ficha.perfil.nome}
                  </button>
                )}

                {/* Tags do lead + botao "+" abrindo o seletor existente. */}
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                  {ficha.tags.map((t) => (
                    <span
                      key={t.id}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-medium',
                        classesCorTag(t.cor)
                      )}
                    >
                      {t.nome}
                    </span>
                  ))}
                  <button
                    type="button"
                    title="Adicionar tag"
                    aria-label="Adicionar tag"
                    onClick={() => setMostrarTags((v) => !v)}
                    className="flex size-5 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                {mostrarTags && (
                  <div className="mt-2 text-left">
                    <TagsSelect
                      value={ficha.tags.map((t) => t.id)}
                      onChange={(ids) => void aoMudarTags(ids)}
                    />
                  </div>
                )}

                {/* Atendente responsavel. */}
                <div className="mt-3 pb-2 text-left">
                  <Label className="text-xs text-muted-foreground">Atendente</Label>
                  <Select
                    value={ficha.perfil.donoId ?? 'nenhum'}
                    onValueChange={aoTrocarAtendente}
                  >
                    <SelectTrigger className="mt-1 h-8 w-full bg-background">
                      <SelectValue placeholder="Sem atendente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem atendente</SelectItem>
                      {ficha.atendentes.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Metricas (imagem04): derivadas dos negocios GANHOS. */}
              <SecaoRecolhivel titulo="Metricas">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { rotulo: 'Ticket medio', valor: formatoBRL.format(ficha.metricas.ticketMedio) },
                    { rotulo: 'Total', valor: formatoBRL.format(ficha.metricas.total) },
                    { rotulo: 'Ciclo de compra', valor: `${ficha.metricas.cicloCompraDias}d` },
                    { rotulo: 'Ultima compra', valor: `${ficha.metricas.ultimaCompraDias}d` },
                  ].map((m) => (
                    <div key={m.rotulo} className="rounded-lg border bg-card px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">{m.rotulo}</p>
                      <p className="text-sm font-semibold tabular-nums">{m.valor}</p>
                    </div>
                  ))}
                </div>
              </SecaoRecolhivel>

              {/* Notas: salva no blur. */}
              <SecaoRecolhivel titulo="Notas">
                <Textarea
                  rows={4}
                  value={notasRascunho}
                  onChange={(e) => setNotasRascunho(e.target.value)}
                  onBlur={() => void salvarNotas()}
                  placeholder="Anotacoes sobre o lead..."
                />
                {salvandoNotas && (
                  <p className="mt-1 text-[10px] text-muted-foreground">Salvando...</p>
                )}
              </SecaoRecolhivel>

              {/* Respostas do formulario + Rastreamento (UTM): so aparecem quando
                  o lead veio de captacao externa (webhook) com esses dados. */}
              {(() => {
                const { respostas, utm } = extrairDetalheLead(ficha.perfil.origemDetalhe)
                const LABEL_UTM: Record<string, string> = {
                  utm_source: 'Origem',
                  utm_medium: 'Mídia',
                  utm_campaign: 'Campanha',
                  utm_content: 'Anúncio / Conteúdo',
                  utm_term: 'Termo / Palavra-chave',
                }
                const utmEntradas = Object.entries(utm)
                return (
                  <>
                    {respostas.length > 0 && (
                      <SecaoRecolhivel titulo="Respostas do formulário">
                        <dl className="space-y-3">
                          {respostas.map((r, i) => (
                            <div key={i} className="space-y-0.5">
                              <dt className="text-xs text-muted-foreground">{r.pergunta}</dt>
                              <dd className="text-sm font-medium">{r.resposta}</dd>
                            </div>
                          ))}
                        </dl>
                      </SecaoRecolhivel>
                    )}

                    {utmEntradas.length > 0 && (
                      <SecaoRecolhivel titulo="Rastreamento">
                        <dl className="space-y-2">
                          {utmEntradas.map(([chave, valor]) => (
                            <div
                              key={chave}
                              className="flex items-baseline justify-between gap-3"
                            >
                              <dt className="shrink-0 text-xs text-muted-foreground">
                                {LABEL_UTM[chave] ?? chave}
                              </dt>
                              <dd className="truncate text-right text-sm font-medium" title={valor}>
                                {valor}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </SecaoRecolhivel>
                    )}
                  </>
                )
              })()}

              {/* Cadastro em abas (form RHF unico — Salvar vale para as 3). */}
              <div className="border-t px-4 py-4">
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <Tabs defaultValue="perfil">
                    <TabsList className="w-full">
                      <TabsTrigger value="perfil">Perfil</TabsTrigger>
                      <TabsTrigger value="endereco">Endereco</TabsTrigger>
                      <TabsTrigger value="adicionais">Campos adicionais</TabsTrigger>
                    </TabsList>

                    {/* forceMount + hidden: trocar de aba NAO pode desmontar os
                        inputs do RHF (mesmo padrao do modal Novo Lead). */}
                    <TabsContent
                      value="perfil"
                      forceMount
                      className="mt-3 space-y-3 data-[state=inactive]:hidden"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-nome">Nome</Label>
                        <Input id="ficha-nome" {...register('nome')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Empresa</Label>
                        {/* Somente leitura por ora: trocar a empresa exige um
                            seletor de empresas que nao entra nesta entrega. */}
                        <Input value={ficha.perfil.empresaNome ?? 'Sem empresa'} readOnly disabled />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-email">E-mail</Label>
                        <Input id="ficha-email" type="email" {...register('email')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-telefone">Telefone</Label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base" aria-hidden="true">
                            🇧🇷
                          </span>
                          <Input
                            id="ficha-telefone"
                            inputMode="tel"
                            value={telefone}
                            onChange={(e) => setValue('telefone', mascararTelefone(e.target.value))}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Copiar telefone"
                            onClick={copiarTelefone}
                            className="size-8 shrink-0"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-documento">Documento</Label>
                        <Input
                          id="ficha-documento"
                          inputMode="numeric"
                          placeholder="Informe o CPF ou CNPJ"
                          value={documento}
                          onChange={(e) => setValue('documento', mascararDocumento(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Origem</Label>
                        <Select
                          value={origem ?? 'manual'}
                          onValueChange={(v) =>
                            setValue('origem', v as (typeof ORIGENS_LEAD)[number])
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Origem" />
                          </SelectTrigger>
                          <SelectContent>
                            {ORIGENS_LEAD.map((o) => (
                              <SelectItem key={o} value={o}>
                                {nomeOrigem(o)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-site">Site</Label>
                        <Input id="ficha-site" {...register('site')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-nascimento">Data de nascimento</Label>
                        <Input id="ficha-nascimento" type="date" {...register('dataNascimento')} />
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="endereco"
                      forceMount
                      className="mt-3 space-y-3 data-[state=inactive]:hidden"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-cep">CEP</Label>
                        <Input id="ficha-cep" {...register('cep')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-endereco">Endereco</Label>
                        <Input id="ficha-endereco" {...register('endereco')} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="ficha-numero">Numero</Label>
                          <Input id="ficha-numero" {...register('numero')} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ficha-complemento">Complemento</Label>
                          <Input id="ficha-complemento" {...register('complemento')} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-bairro">Bairro</Label>
                        <Input id="ficha-bairro" {...register('bairro')} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="ficha-cidade">Cidade</Label>
                          <Input id="ficha-cidade" {...register('cidade')} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ficha-estado">Estado</Label>
                          <Input id="ficha-estado" {...register('estado')} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-pais">Pais</Label>
                        <Input id="ficha-pais" {...register('pais')} />
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="adicionais"
                      forceMount
                      className="mt-3 space-y-3 data-[state=inactive]:hidden"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="ficha-cargo">Cargo</Label>
                        <Input id="ficha-cargo" {...register('cargo')} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lead cadastrado em {formatarDia(ficha.perfil.createdAt)}.
                      </p>
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" disabled={isPending} className="mt-4 w-full">
                    {isPending ? 'Salvando...' : 'Salvar cadastro'}
                  </Button>
                </form>
              </div>
              {/* Acao destrutiva no rodape do painel esquerdo. */}
              <div className="border-t p-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmarExclusao(true)}
                >
                  <Trash2 className="size-4" />
                  Excluir lead
                </Button>
              </div>
            </div>

            {/* ============ PAINEL DIREITO ============ */}
            <div className="md:min-h-0 md:overflow-y-auto">
              {/* Ordem pedida pelo usuário: Negócio primeiro (aba padrão), depois
                  Atividades e por último Histórico — igual à referência. */}
              <Tabs defaultValue="negocio" className="p-4">
                <TabsList className="w-full">
                  <TabsTrigger value="negocio">Informacoes do Negocio</TabsTrigger>
                  <TabsTrigger value="atividades">Atividades</TabsTrigger>
                  <TabsTrigger value="historico">Historico</TabsTrigger>
                </TabsList>

                {/* --- HISTORICO: timeline agrupada por dia --- */}
                <TabsContent value="historico" className="mt-4 space-y-4">
                  {ficha.historico.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                      Sem historico registrado.
                    </p>
                  ) : (
                    agruparPorDia(ficha.historico, (h) => h.createdAt).map(([dia, itens]) => (
                      <div key={dia}>
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">{dia}</p>
                        <div className="space-y-2 border-l pl-4">
                          {itens.map((h) => {
                            const Icone = ICONE_ATIVIDADE[h.tipo] ?? Check
                            return (
                              <div key={h.id} className="relative flex items-start gap-3 pb-1">
                                <span className="absolute -left-[25px] flex size-4 items-center justify-center rounded-full border bg-background">
                                  <Icone className="size-2.5 text-muted-foreground" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium">
                                    {ROTULO_ATIVIDADE[h.tipo] ?? h.tipo}
                                    {h.de && h.para && (
                                      <span className="font-normal text-muted-foreground">
                                        {' '}
                                        — {h.de} para {h.para}
                                      </span>
                                    )}
                                  </p>
                                  {h.detalhe && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {h.detalhe}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground">{h.autorNome}</p>
                                </div>
                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                  {tempoRelativoCurto(h.createdAt)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* --- ATIVIDADES: lista por dia + modal Criar atividade --- */}
                <TabsContent value="atividades" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Atividades</p>
                    <Button type="button" size="sm" onClick={() => setModalAtividade(true)}>
                      <Plus className="size-3.5" />
                      Atividade
                    </Button>
                  </div>

                  {ficha.atividades.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                      Nenhuma atividade. Crie a primeira.
                    </p>
                  ) : (
                    agruparPorDia(
                      ficha.atividades,
                      (a) => a.dataInicio ?? a.dataVencimento
                    ).map(([dia, itens]) => (
                      <div key={dia}>
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">{dia}</p>
                        <div className="space-y-2">
                          {itens.map((a) => (
                            <div
                              key={a.id}
                              className={cn(
                                'flex items-start gap-3 rounded-lg border bg-card p-3',
                                a.concluida && 'opacity-60'
                              )}
                            >
                              <button
                                type="button"
                                title={a.concluida ? 'Atividade concluida' : 'Concluir atividade'}
                                aria-label={
                                  a.concluida ? 'Atividade concluida' : 'Concluir atividade'
                                }
                                disabled={a.concluida || isPending}
                                onClick={() => concluirAtividade(a.id)}
                                className={cn(
                                  'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                                  a.concluida
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'hover:border-emerald-400'
                                )}
                              >
                                {a.concluida && <Check className="size-3" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    'text-sm font-medium',
                                    a.concluida && 'line-through'
                                  )}
                                >
                                  {a.titulo}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ROTULO_TIPO_TAREFA[a.tipo] ?? a.tipo}
                                  {a.dataInicio && a.dataFim && (
                                    <>
                                      {' · '}
                                      {formatarHora(a.dataInicio)}–{formatarHora(a.dataFim)}
                                    </>
                                  )}
                                  {a.donoNome && <> · {a.donoNome}</>}
                                </p>
                                {a.notas && (
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {a.notas}
                                  </p>
                                )}
                              </div>
                              {a.prioridade && (
                                <span
                                  className={cn(
                                    'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium',
                                    CLASSE_PRIORIDADE[a.prioridade] ?? CLASSE_PRIORIDADE.baixa
                                  )}
                                >
                                  {ROTULO_PRIORIDADE[a.prioridade] ?? a.prioridade}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* --- INFORMACOES DO NEGOCIO: cards + Pipeline Completa --- */}
                <TabsContent value="negocio" className="mt-4 space-y-4">
                  {ficha.negocios.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                      Esse lead ainda nao tem negocios.
                    </p>
                  ) : (
                    <>
                      {/* Seletor do negocio (default: o mais recente aberto). */}
                      {ficha.negocios.length > 1 && (
                        <Select
                          value={negocioSelecionado ?? undefined}
                          onValueChange={setNegocioSelecionado}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Escolha o negocio" />
                          </SelectTrigger>
                          <SelectContent>
                            {ficha.negocios.map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                #{n.numero} — {rotuloServico(n.servico)}
                                {n.status === 'ganha'
                                  ? ' (Ganho)'
                                  : n.status === 'perdida'
                                    ? ' (Perdido)'
                                    : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {negocio && (
                        <>
                          {/* Tres cards coloridos da imagem04. */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
                              <p className="text-xs text-blue-700 dark:text-blue-300">Numero</p>
                              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                #{negocio.numero}
                              </p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                Valor Total
                              </p>
                              <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                {negocio.valor != null ? formatoBRL.format(negocio.valor) : '—'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/40">
                              <p className="text-xs text-violet-700 dark:text-violet-300">
                                Data de Criacao
                              </p>
                              <p className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300">
                                {formatarDia(negocio.createdAt)}
                              </p>
                            </div>
                          </div>

                          {/* Servico + motivo de perda (contexto honesto). */}
                          <p className="text-xs text-muted-foreground">
                            {rotuloServico(negocio.servico)}
                            {negocio.status === 'perdida' && negocio.motivoPerda && (
                              <> · Motivo da perda: {negocio.motivoPerda}</>
                            )}
                          </p>

                          {/* Pipeline Completa: etapas reais + Ganho/Perdido no fim. */}
                          <div>
                            <p className="mb-3 text-sm font-semibold">Pipeline Completa</p>
                            <div className="flex items-start gap-0 overflow-x-auto pb-2">
                              {[
                                ...etapasDoNegocio.map((e) => ({
                                  chave: e.id,
                                  nome: e.nome,
                                  atual: negocio.status === 'aberta' && e.id === negocio.etapaId,
                                  fechada: false,
                                })),
                                {
                                  chave: 'ganho',
                                  nome: 'Ganho',
                                  atual: negocio.status === 'ganha',
                                  fechada: true,
                                },
                                {
                                  chave: 'perdido',
                                  nome: 'Perdido',
                                  atual: negocio.status === 'perdida',
                                  fechada: true,
                                },
                              ].map((etapa, i, lista) => (
                                <div
                                  key={etapa.chave}
                                  className="flex min-w-20 flex-1 flex-col items-center"
                                >
                                  <div className="flex w-full items-center">
                                    <div
                                      className={cn(
                                        'h-px flex-1',
                                        i === 0 ? 'bg-transparent' : 'bg-border'
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'flex size-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                                        etapa.atual
                                          ? etapa.chave === 'perdido'
                                            ? 'border-red-500 bg-red-500 text-white'
                                            : 'border-emerald-500 bg-emerald-500 text-white'
                                          : 'bg-background text-muted-foreground'
                                      )}
                                    >
                                      {etapa.atual ? <Check className="size-3.5" /> : i + 1}
                                    </span>
                                    <div
                                      className={cn(
                                        'h-px flex-1',
                                        i === lista.length - 1 ? 'bg-transparent' : 'bg-border'
                                      )}
                                    />
                                  </div>
                                  <p
                                    className={cn(
                                      'mt-1.5 max-w-24 truncate text-center text-[10px]',
                                      etapa.atual
                                        ? 'font-semibold text-foreground'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {etapa.nome}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* --- PRODUTOS E VALORES (imagem04): produtos DENTRO do
                          negocio selecionado; total no fim. --- */}
                      <div className="rounded-lg border">
                        <div className="flex items-center justify-between border-b px-4 py-3">
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <Package className="size-4 text-muted-foreground" />
                            Produtos e Valores
                          </p>
                        </div>

                        <div className="divide-y">
                          {produtosDoNegocio(negocio).map((p, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {rotuloServico(p.servico)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">R$</span>
                                <Input
                                  value={valoresRascunho[String(i)] ?? (p.valor != null ? String(p.valor) : '')}
                                  onChange={(e) =>
                                    setValoresRascunho((prev) => ({ ...prev, [String(i)]: e.target.value }))
                                  }
                                  onBlur={() => void salvarValorProduto(i)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                  }}
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  className="h-8 w-28 text-right tabular-nums"
                                />
                                <button
                                  type="button"
                                  title="Remover produto"
                                  aria-label="Remover produto"
                                  onClick={() => void excluirProduto(i)}
                                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Adicionar produto: servico + valor numa linha so. */}
                        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-3">
                          <Select
                            value={novoProdutoServico || undefined}
                            onValueChange={(v) => setNovoProdutoServico(v as ServicoJsr)}
                          >
                            <SelectTrigger size="sm" className="w-52">
                              <SelectValue placeholder="Adicionar produto..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(SERVICOS_JSR) as ServicoJsr[]).map((chave) => (
                                <SelectItem key={chave} value={chave}>
                                  {SERVICOS_JSR[chave]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={novoProdutoValor}
                            onChange={(e) => setNovoProdutoValor(e.target.value)}
                            inputMode="decimal"
                            placeholder="Valor (R$)"
                            className="h-8 w-28 text-right tabular-nums"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={salvandoProduto || !novoProdutoServico}
                            onClick={() => void adicionarProduto()}
                          >
                            <Plus className="size-3.5" />
                            Adicionar
                          </Button>
                        </div>

                        {/* Total: soma dos produtos do negocio selecionado. */}
                        <div className="flex items-center justify-between border-t px-4 py-3">
                          <p className="text-sm font-semibold">Total</p>
                          <p className="text-sm font-bold tabular-nums">
                            {formatoBRL.format(
                              produtosDoNegocio(negocio).reduce((soma, p) => soma + (p.valor ?? 0), 0),
                            )}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Modal "Criar atividade" (cria_atividade.png). */}
        {ficha && contatoId && (
          <CriarAtividadeDialog
            aberto={modalAtividade}
            onOpenChange={setModalAtividade}
            contatoId={contatoId}
            contatoNome={ficha.perfil.nome}
            negocios={ficha.negocios.map((n) => ({
              id: n.id,
              servico: n.servico,
              numero: n.numero,
              status: n.status,
            }))}
            atendentes={ficha.atendentes}
            donoPadraoId={ficha.usuarioId}
            onCriada={() => {
              if (contatoId) void carregar(contatoId, true)
              router.refresh()
            }}
          />
        )}
        {/* Confirmacao de exclusao do lead (leva os negocios junto). */}
        <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir o lead “{ficha?.perfil.nome}”?</AlertDialogTitle>
              <AlertDialogDescription>
                O cadastro e TODOS os negocios deste lead serao excluidos. Esta acao nao pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={excluindo}
                onClick={(e) => {
                  e.preventDefault()
                  void confirmarExcluirLead()
                }}
              >
                {excluindo ? 'Excluindo...' : 'Excluir lead'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
