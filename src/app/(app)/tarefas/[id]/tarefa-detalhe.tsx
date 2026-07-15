'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUp,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  History,
  Link2,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pin,
  Play,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TarefaDetalhe as TarefaDetalheTipo, ItemChecklist } from '@/lib/tarefas/dados'
import {
  RECORRENCIA_LABEL,
  STATUS_LABEL,
  PRIORIDADE_LABEL,
  PRIORIDADE_ORDEM,
  DIAS_SEMANA_LABEL,
  DIAS_SEMANA_NOME,
  type TarefaRecorrencia,
  type TarefaStatus,
  type TarefaPrioridade,
} from '@/lib/tarefas/recorrencia'
import {
  COLUNAS_ORDEM,
  PRIORIDADE_CLASSE,
  STATUS_CLASSE,
  agruparChecklist,
  codigoTarefa,
  corDaEtiqueta,
  corDoAvatar,
  iniciais,
  progressoChecklist,
  tempoRelativo,
} from '@/lib/tarefas/quadro'
import {
  atualizarTarefa,
  atualizarRecorrencia,
  deletarTarefa,
  addChecklistItemTarefa,
  toggleChecklistItemTarefa,
  deleteChecklistItemTarefa,
  criarComentario,
  deletarComentario,
  uploadAnexoTarefa,
  deletarAnexoTarefa,
  getUrlAnexoTarefa,
} from '@/actions/tarefas'
import type { AtualizarTarefaInput } from '@/lib/validations/tarefa'
import { TarefaLateral, AnexoLinha, AtividadeLinha } from './tarefa-lateral'

const NENHUM = '__nenhum__'

const RECORRENCIAS: TarefaRecorrencia[] = [
  'nenhuma',
  'diaria',
  'dias_uteis',
  'dia_sim_dia_nao',
  'semanal',
  'mensal',
  'anual',
  'personalizada',
]

// Controles da grade parecem VALOR + chevron, não caixinha de formulário.
const SELECT_CELULA = 'h-auto w-full border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0'
const DATA_CELULA = 'h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'

export function TarefaDetalhe({
  tarefa,
  clientes,
  responsaveis,
  usuarioId,
}: {
  tarefa: TarefaDetalheTipo
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  usuarioId: string
}) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()
  const [enviandoAnexo, startAnexo] = useTransition()

  // "Agora" calculado UMA vez no client (tempoRelativo é puro e recebe o agora).
  const [agora] = useState(() => new Date().toISOString())
  // D-12: abas controladas — os links "Ver tudo" dos cards laterais trocam de aba.
  const [aba, setAba] = useState('detalhes')

  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao ?? '')
  const [editandoDescricao, setEditandoDescricao] = useState(false)
  const [novaEtiqueta, setNovaEtiqueta] = useState('')

  const [itens, setItens] = useState<ItemChecklist[]>(tarefa.checklist)
  const [novoItem, setNovoItem] = useState<Record<string, string>>({})
  // Qual grupo está com o campo "Adicionar item" aberto (mockup mostra só o link).
  const [itemAberto, setItemAberto] = useState<string | null>(null)
  const [gruposNovos, setGruposNovos] = useState<string[]>([])
  const [nomeGrupoNovo, setNomeGrupoNovo] = useState('')
  const [criandoGrupo, setCriandoGrupo] = useState(false)

  const [novoComentario, setNovoComentario] = useState('')

  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false)
  const [recorrencia, setRecorrencia] = useState<TarefaRecorrencia>(tarefa.recorrencia)
  const [dias, setDias] = useState<number[]>(tarefa.recorrenciaDias ?? [])
  const [excluirAberto, setExcluirAberto] = useState(false)

  const anexoTabRef = useRef<HTMLInputElement>(null)

  const codigo = tarefa.codigo ?? codigoTarefa(tarefa.codigoNum)
  const concluida = tarefa.status === 'concluida'
  const temSerie = tarefa.recorrencia !== 'nenhuma' || Boolean(tarefa.tarefaMaeId)

  /** Salva um campo e recarrega — o padrão de todo campo inline daqui. */
  function salvarCampo(campos: AtualizarTarefaInput, aoConcluir?: () => void) {
    startSalvar(async () => {
      const r = await atualizarTarefa(tarefa.id, campos)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      aoConcluir?.()
      router.refresh()
    })
  }

  function copiarCodigo() {
    navigator.clipboard
      .writeText(codigo)
      .then(() => toast.success('Codigo copiado.'))
      .catch(() => toast.error('Nao foi possivel copiar o codigo.'))
  }

  // D-07: Compartilhar e o ícone de link são a MESMA ação — copiam a URL da tarefa.
  function copiarLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Link copiado.'))
      .catch(() => toast.error('Nao foi possivel copiar o link.'))
  }

  function toggleDia(d: number) {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()))
  }

  function salvarRecorrencia() {
    if (recorrencia === 'personalizada' && dias.length === 0) {
      toast.error('Escolha ao menos um dia da semana.')
      return
    }
    startSalvar(async () => {
      const r = await atualizarRecorrencia(tarefa.id, { recorrencia, recorrenciaDias: dias })
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Recorrencia salva.')
      setRecorrenciaAberta(false)
      router.refresh()
    })
  }

  function encerrarSerie() {
    startSalvar(async () => {
      const r = await atualizarRecorrencia(tarefa.id, {
        recorrencia: tarefa.recorrencia,
        recorrenciaDias: tarefa.recorrenciaDias ?? [],
        ativa: false,
      })
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Recorrencia encerrada. Nenhuma nova ocorrencia sera criada.')
      router.refresh()
    })
  }

  function excluir() {
    startSalvar(async () => {
      const r = await deletarTarefa(tarefa.id)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Tarefa excluida.')
      router.push('/tarefas')
    })
  }

  function adicionarItem(grupo: string) {
    const texto = (novoItem[grupo] ?? '').trim()
    if (!texto) return

    startSalvar(async () => {
      const r = await addChecklistItemTarefa(tarefa.id, texto, grupo)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      setItens((a) => [...a, { id: r.data.id, texto, concluido: false, ordem: a.length, grupo }])
      setNovoItem((n) => ({ ...n, [grupo]: '' }))
      setGruposNovos((g) => g.filter((x) => x !== grupo))
      router.refresh()
    })
  }

  function alternarItem(item: ItemChecklist) {
    const novo = !item.concluido
    setItens((a) => a.map((i) => (i.id === item.id ? { ...i, concluido: novo } : i)))

    startSalvar(async () => {
      const r = await toggleChecklistItemTarefa(item.id, novo)
      if ('error' in r) {
        toast.error(r.error)
        setItens((a) => a.map((i) => (i.id === item.id ? { ...i, concluido: !novo } : i)))
        return
      }
      router.refresh()
    })
  }

  function removerItem(item: ItemChecklist) {
    setItens((a) => a.filter((i) => i.id !== item.id))
    startSalvar(async () => {
      const r = await deleteChecklistItemTarefa(item.id)
      if ('error' in r) toast.error(r.error)
      else router.refresh()
    })
  }

  function criarGrupo() {
    const nome = nomeGrupoNovo.trim()
    if (!nome) return
    setGruposNovos((g) => (g.includes(nome) ? g : [...g, nome]))
    setNomeGrupoNovo('')
    setCriandoGrupo(false)
    // Grupo novo já abre pronto para receber o primeiro item.
    setItemAberto(nome)
  }

  /** Apaga todos os itens do grupo — o "..." do card de checklist do mockup.
   *  Sequencial de propósito (nada de paralelizar com Promise). */
  function excluirGrupo(grupo: { nome: string; itens: ItemChecklist[] }) {
    startSalvar(async () => {
      for (const item of grupo.itens) {
        const r = await deleteChecklistItemTarefa(item.id)
        if ('error' in r) {
          toast.error(r.error)
          return
        }
      }
      setItens((a) => a.filter((i) => (i.grupo || 'Checklist') !== grupo.nome))
      setGruposNovos((g) => g.filter((x) => x !== grupo.nome))
      router.refresh()
    })
  }

  function removerEtiqueta(etiqueta: string) {
    salvarCampo({ etiquetas: tarefa.etiquetas.filter((e) => e !== etiqueta) })
  }

  function adicionarEtiqueta() {
    const nova = novaEtiqueta.trim()
    if (!nova || tarefa.etiquetas.includes(nova)) {
      setNovaEtiqueta('')
      return
    }
    salvarCampo({ etiquetas: [...tarefa.etiquetas, nova] }, () => setNovaEtiqueta(''))
  }

  function enviarComentario() {
    const texto = novoComentario.trim()
    if (!texto) return
    startSalvar(async () => {
      const r = await criarComentario(tarefa.id, { texto })
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      setNovoComentario('')
      router.refresh()
    })
  }

  function removerComentario(id: string) {
    startSalvar(async () => {
      const r = await deletarComentario(id)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  // --- Anexos: fonte única, usada no card lateral E na aba Anexos ---
  function enviarAnexo(file: File) {
    startAnexo(async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tarefaId', tarefa.id)
      const r = await uploadAnexoTarefa(fd)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Arquivo anexado.')
      router.refresh()
    })
  }

  function baixarAnexo(id: string) {
    startAnexo(async () => {
      const r = await getUrlAnexoTarefa(id)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      window.open(r.data.url, '_blank')
    })
  }

  function removerAnexo(id: string) {
    startAnexo(async () => {
      const r = await deletarAnexoTarefa(id)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Arquivo removido.')
      router.refresh()
    })
  }

  const grupos = agruparChecklist(itens)
  const gruposVisiveis = [
    ...grupos,
    ...gruposNovos
      .filter((n) => !grupos.some((g) => g.nome === n))
      .map((nome) => ({ nome, itens: [] as ItemChecklist[], total: 0, feitos: 0 })),
  ]

  const responsavelDaTarefa = responsaveis.find((r) => r.id === tarefa.responsavelId)

  /** Card de grupo de checklist FIEL ao mockup: nome + "2 / 6" + barra na mesma
   *  linha, ícones de responsável/data à direita, "..." com ação real; item com
   *  checkbox verde, avatar e "--"; rodapé "+ Adicionar item". */
  function renderGrupo(grupo: { nome: string; itens: ItemChecklist[]; total: number; feitos: number }) {
    return (
      <Card key={grupo.nome} className="gap-3 py-4">
        <CardHeader className="flex items-center gap-3 space-y-0">
          <CardTitle className="text-sm">{grupo.nome}</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {grupo.feitos} / {grupo.total}
          </span>
          <Progress value={progressoChecklist(grupo.feitos, grupo.total)} className="h-1.5 w-28" />
          <span className="ml-auto flex items-center gap-3 text-muted-foreground">
            <Users className="size-4" />
            <CalendarDays className="size-4" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Ações do checklist ${grupo.nome}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => excluirGrupo(grupo)}
                >
                  Excluir checklist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {grupo.itens.map((item) => (
            <div key={item.id} className="group flex items-center gap-2 py-1.5">
              <Checkbox
                checked={item.concluido}
                onCheckedChange={() => alternarItem(item)}
                aria-label={item.texto}
                className="data-[state=checked]:border-chart-success data-[state=checked]:bg-chart-success"
              />
              <span
                className={
                  item.concluido
                    ? 'flex-1 text-sm text-muted-foreground line-through'
                    : 'flex-1 text-sm'
                }
              >
                {item.texto}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 group-hover:opacity-100"
                onClick={() => removerItem(item)}
                aria-label={`Remover ${item.texto}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
              {responsavelDaTarefa ? (
                <Avatar size="sm">
                  <AvatarFallback
                    className={`text-[10px] font-semibold ${corDoAvatar(tarefa.responsavelId)}`}
                  >
                    {iniciais(responsavelDaTarefa.nome)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-muted">
                  <Users className="size-3 text-muted-foreground" />
                </span>
              )}
              <span className="w-6 text-right text-xs text-muted-foreground">--</span>
            </div>
          ))}

          {itemAberto === grupo.nome ? (
            <div className="flex gap-2 pt-2">
              <Input
                value={novoItem[grupo.nome] ?? ''}
                onChange={(e) => setNovoItem((n) => ({ ...n, [grupo.nome]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionarItem(grupo.nome)
                  }
                  if (e.key === 'Escape') setItemAberto(null)
                }}
                placeholder="Escreva o item e pressione Enter..."
                autoFocus
                aria-label={`Novo item em ${grupo.nome}`}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => adicionarItem(grupo.nome)}
                disabled={salvando}
              >
                Adicionar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mt-1 text-muted-foreground"
              onClick={() => setItemAberto(grupo.nome)}
            >
              <Plus className="size-4" />
              Adicionar item
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barra superior — faixa branca de ponta a ponta com borda, como no mockup */}
      <div className="-mx-6 -mt-6 flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-3 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/tarefas">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/tarefas" className="hover:text-foreground">
              Tarefas
            </Link>
            <ChevronRight className="size-3" />
            <span>Detalhes da Tarefa</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copiarLink}>
            <Share2 className="size-4" />
            Compartilhar
          </Button>
          <Button variant="outline" size="icon" onClick={copiarLink} aria-label="Copiar link da tarefa">
            <Link2 className="size-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais ações">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRecorrenciaAberta(true)}>
                Recorrência
              </DropdownMenuItem>
              {temSerie && (
                <DropdownMenuItem onClick={encerrarSerie}>Encerrar recorrência</DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setExcluirAberto(true)}
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={concluida ? 'outline' : 'default'}
            disabled={salvando}
            onClick={() => salvarCampo({ status: concluida ? 'a_fazer' : 'concluida' })}
          >
            <Check className="size-4" />
            {concluida ? 'Reabrir tarefa' : 'Marcar como concluída'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna esquerda */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="gap-4 py-5">
            <CardHeader className="flex items-center justify-between space-y-0">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="tabular-nums">
                  {codigo}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={copiarCodigo}
                  aria-label="Copiar codigo da tarefa"
                >
                  <Copy className="size-3.5" />
                </Button>
                {tarefa.recorrencia !== 'nenhuma' && (
                  <Badge variant="secondary">{RECORRENCIA_LABEL[tarefa.recorrencia]}</Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => salvarCampo({ fixada: !tarefa.fixada })}
                  aria-label={tarefa.fixada ? 'Desafixar tarefa' : 'Fixar tarefa'}
                  title={tarefa.fixada ? 'Desafixar' : 'Fixar no topo da coluna'}
                >
                  <Pin className={tarefa.fixada ? 'size-4 fill-current text-primary' : 'size-4'} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={copiarLink}
                  aria-label="Copiar link"
                >
                  <Link2 className="size-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onBlur={() => {
                    const limpo = titulo.trim()
                    if (!limpo) {
                      toast.error('Informe o titulo da tarefa.')
                      setTitulo(tarefa.titulo)
                      return
                    }
                    if (limpo !== tarefa.titulo) salvarCampo({ titulo: limpo })
                  }}
                  className="h-auto border-0 px-0 text-[26px] leading-tight font-semibold shadow-none focus-visible:ring-0"
                  aria-label="Título da tarefa"
                />
                {tarefa.descricao && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{tarefa.descricao}</p>
                )}
              </div>

              {/* Grade de 8 células COM BORDA e DIVISÓRIAS */}
              <div className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card md:grid-cols-4">
                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select
                    value={tarefa.status}
                    onValueChange={(v) => salvarCampo({ status: v as TarefaStatus })}
                  >
                    <SelectTrigger className={SELECT_CELULA}>
                      <Badge variant="outline" className={STATUS_CLASSE[tarefa.status]}>
                        {tarefa.status === 'em_andamento' && <Play className="size-3 fill-current" />}
                        {STATUS_LABEL[tarefa.status]}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {COLUNAS_ORDEM.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Select
                    value={tarefa.responsavelId ?? NENHUM}
                    onValueChange={(v) => salvarCampo({ responsavelId: v === NENHUM ? '' : v })}
                  >
                    <SelectTrigger className={SELECT_CELULA}>
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Nenhum</SelectItem>
                      {responsaveis.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback
                                className={`text-[10px] font-semibold ${corDoAvatar(r.id)}`}
                              >
                                {iniciais(r.nome)}
                              </AvatarFallback>
                            </Avatar>
                            {r.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Prioridade</Label>
                  <Select
                    value={tarefa.prioridade}
                    onValueChange={(v) => salvarCampo({ prioridade: v as TarefaPrioridade })}
                  >
                    <SelectTrigger className={SELECT_CELULA}>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {(tarefa.prioridade === 'alta' || tarefa.prioridade === 'urgente') && (
                          <ArrowUp className="size-3.5 text-destructive" />
                        )}
                        {PRIORIDADE_LABEL[tarefa.prioridade]}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADE_ORDEM.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-1.5">
                            {(p === 'alta' || p === 'urgente') && <ArrowUp className="size-3" />}
                            <Badge variant="outline" className={PRIORIDADE_CLASSE[p]}>
                              {PRIORIDADE_LABEL[p]}
                            </Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Etiquetas</Label>
                  <div className="flex flex-wrap items-center gap-1">
                    {tarefa.etiquetas.map((e) => (
                      <Badge key={e} variant="outline" className={`gap-1 ${corDaEtiqueta(e)}`}>
                        {e}
                        <button
                          type="button"
                          onClick={() => removerEtiqueta(e)}
                          aria-label={`Remover etiqueta ${e}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={novaEtiqueta}
                      onChange={(e) => setNovaEtiqueta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          adicionarEtiqueta()
                        }
                      }}
                      placeholder="adicionar"
                      className="h-6 w-24 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                      aria-label="Adicionar etiqueta"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Data de início</Label>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      type="date"
                      defaultValue={tarefa.dataInicio ?? ''}
                      onChange={(e) => salvarCampo({ dataInicio: e.target.value })}
                      className={DATA_CELULA}
                      aria-label="Data de inicio"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Prazo</Label>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      type="date"
                      defaultValue={tarefa.data}
                      onChange={(e) => e.target.value && salvarCampo({ data: e.target.value })}
                      className={DATA_CELULA}
                      aria-label="Prazo"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Tempo estimado</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      defaultValue={tarefa.tempoEstimado ?? ''}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (tarefa.tempoEstimado ?? '')) {
                          salvarCampo({ tempoEstimado: e.target.value.trim() })
                        }
                      }}
                      placeholder="4h"
                      className={DATA_CELULA}
                      aria-label="Tempo estimado"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Projeto / Cliente</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <Select
                      value={tarefa.clienteId ?? NENHUM}
                      onValueChange={(v) => salvarCampo({ clienteId: v === NENHUM ? '' : v })}
                    >
                      <SelectTrigger className={SELECT_CELULA}>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NENHUM}>Nenhum</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Abas underline, 5 delas, com contador real */}
          <Tabs value={aba} onValueChange={setAba}>
            <TabsList className="h-auto w-full justify-start gap-4 rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="detalhes"
                className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <FileText className="size-4" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="checklists"
                className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <ListChecks className="size-4" />
                Checklists{itens.length > 0 && ` ${itens.length}`}
              </TabsTrigger>
              <TabsTrigger value="anexos"
                className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <Paperclip className="size-4" />
                Anexos{tarefa.anexos.length > 0 && ` ${tarefa.anexos.length}`}
              </TabsTrigger>
              <TabsTrigger value="comentarios"
                className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <MessageSquare className="size-4" />
                Comentários{tarefa.comentarios.length > 0 && ` ${tarefa.comentarios.length}`}
              </TabsTrigger>
              <TabsTrigger value="atividade"
                className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <History className="size-4" />
                Atividade
              </TabsTrigger>
            </TabsList>

            {/* Detalhes: Descrição + Checklists */}
            <TabsContent value="detalhes" className="mt-4 space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Descrição</h3>
                {/* Mockup: texto limpo, sem caixa. Clica para editar; blur salva. */}
                {editandoDescricao ? (
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    onBlur={() => {
                      setEditandoDescricao(false)
                      if (descricao !== (tarefa.descricao ?? '')) salvarCampo({ descricao })
                    }}
                    rows={8}
                    autoFocus
                    placeholder="Detalhes, contexto, links..."
                    aria-label="Descrição da tarefa"
                  />
                ) : (
                  <button
                    type="button"
                    className="w-full whitespace-pre-wrap rounded-md text-left text-sm leading-relaxed hover:bg-muted/50"
                    onClick={() => setEditandoDescricao(true)}
                    aria-label="Editar descrição"
                  >
                    {descricao || (
                      <span className="text-muted-foreground">Adicionar descrição...</span>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Checklists</h3>
                  {!criandoGrupo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary"
                      onClick={() => setCriandoGrupo(true)}
                    >
                      <Plus className="size-4" />
                      Adicionar checklist
                    </Button>
                  )}
                </div>

                {gruposVisiveis.length === 0 && !criandoGrupo && (
                  <p className="text-sm text-muted-foreground">Nenhum checklist ainda.</p>
                )}

                {gruposVisiveis.map(renderGrupo)}

                {criandoGrupo && (
                  <div className="flex gap-2">
                    <Input
                      value={nomeGrupoNovo}
                      onChange={(e) => setNomeGrupoNovo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          criarGrupo()
                        }
                      }}
                      placeholder="Nome do checklist"
                      autoFocus
                      aria-label="Nome do novo checklist"
                    />
                    <Button variant="secondary" onClick={criarGrupo}>
                      Criar
                    </Button>
                    <Button variant="ghost" onClick={() => setCriandoGrupo(false)}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Checklists (aba dedicada — mesmo conteúdo, atalho direto) */}
            <TabsContent value="checklists" className="mt-4 space-y-4">
              {gruposVisiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum checklist ainda.</p>
              ) : (
                gruposVisiveis.map(renderGrupo)
              )}
            </TabsContent>

            {/* Anexos — lista completa + upload */}
            <TabsContent value="anexos" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={enviandoAnexo}
                  onClick={() => anexoTabRef.current?.click()}
                >
                  <Plus className="size-4" />
                  {enviandoAnexo ? 'Enviando...' : 'Adicionar arquivo'}
                </Button>
                <input
                  ref={anexoTabRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) enviarAnexo(f)
                    e.target.value = ''
                  }}
                />
              </div>
              {tarefa.anexos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum arquivo anexado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {tarefa.anexos.map((a) => (
                    <AnexoLinha
                      key={a.id}
                      anexo={a}
                      onBaixar={baixarAnexo}
                      onRemover={removerAnexo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Comentários */}
            <TabsContent value="comentarios" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Textarea
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  rows={3}
                  placeholder="Escreva um comentário..."
                  aria-label="Novo comentário"
                />
                <div className="flex justify-end">
                  <Button onClick={enviarComentario} disabled={salvando || !novoComentario.trim()}>
                    Comentar
                  </Button>
                </div>
              </div>

              {tarefa.comentarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              ) : (
                <div className="space-y-4">
                  {tarefa.comentarios.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar size="sm">
                        <AvatarFallback
                          className={`text-[10px] font-semibold ${corDoAvatar(c.autorId)}`}
                        >
                          {iniciais(c.autorNome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.autorNome}</span>
                          <span className="text-xs text-muted-foreground">
                            {tempoRelativo(c.createdAt, agora)}
                          </span>
                          {c.autorId === usuarioId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="ml-auto size-7"
                                  aria-label="Ações do comentário"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => removerComentario(c.id)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{c.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Atividade — histórico completo */}
            <TabsContent value="atividade" className="mt-4 space-y-4">
              {tarefa.atividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              ) : (
                tarefa.atividades.map((a) => <AtividadeLinha key={a.id} atv={a} agora={agora} />)
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Coluna direita: Notas, Anexos, Atividade Recente */}
        <div className="lg:col-span-1">
          <TarefaLateral
            tarefa={tarefa}
            agora={agora}
            onIrParaAba={setAba}
            onArquivoEscolhido={enviarAnexo}
            onBaixarAnexo={baixarAnexo}
            onRemoverAnexo={removerAnexo}
            enviandoAnexo={enviandoAnexo}
          />
        </div>
      </div>

      {/* Recorrência: vive no "..." — a série não pode sumir. */}
      <Sheet open={recorrenciaAberta} onOpenChange={setRecorrenciaAberta}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Recorrência</SheetTitle>
            <SheetDescription>
              {tarefa.tarefaMaeId
                ? 'Alterar a recorrência afeta toda a série.'
                : 'Defina se esta tarefa se repete no calendário.'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              <Label>Repetir</Label>
              <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as TarefaRecorrencia)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORRENCIAS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECORRENCIA_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {recorrencia === 'personalizada' && (
              <div className="flex gap-1.5">
                {DIAS_SEMANA_LABEL.map((rotulo, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border p-2 text-xs"
                    title={DIAS_SEMANA_NOME[i]}
                  >
                    <span className="text-muted-foreground">{rotulo}</span>
                    <Checkbox
                      checked={dias.includes(i)}
                      onCheckedChange={() => toggleDia(i)}
                      aria-label={DIAS_SEMANA_NOME[i]}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button onClick={salvarRecorrencia} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar recorrência'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={excluirAberto} onOpenChange={setExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              {tarefa.tarefaMaeId
                ? 'Esta ocorrência será removida. A série continua gerando as próximas — para parar de vez, use "Encerrar recorrência". '
                : ''}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={excluir}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
