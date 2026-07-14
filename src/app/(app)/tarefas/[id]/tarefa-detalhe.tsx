'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
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
  agruparChecklist,
  codigoTarefa,
  corDoAvatar,
  iniciais,
  progressoChecklist,
} from '@/lib/tarefas/quadro'
import {
  atualizarTarefa,
  atualizarRecorrencia,
  deletarTarefa,
  addChecklistItemTarefa,
  toggleChecklistItemTarefa,
  deleteChecklistItemTarefa,
} from '@/actions/tarefas'
import type { AtualizarTarefaInput } from '@/lib/validations/tarefa'

// D-12: o que ficou fora do escopo (arquivos, discussões, histórico, o botão
// de compartilhar do mockup) NÃO é renderizado aqui — nada de aba vazia nem
// de botão morto. Só as 2 abas reais: Detalhes e Checklists.

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

export function TarefaDetalhe({
  tarefa,
  clientes,
  responsaveis,
}: {
  tarefa: TarefaDetalheTipo
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()

  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao ?? '')
  const [notas, setNotas] = useState(tarefa.notas ?? '')
  const [notasSalvas, setNotasSalvas] = useState(false)
  const [novaEtiqueta, setNovaEtiqueta] = useState('')

  const [itens, setItens] = useState<ItemChecklist[]>(tarefa.checklist)
  const [novoItem, setNovoItem] = useState<Record<string, string>>({})
  // Grupo recém-criado vive só no client até o primeiro item ser salvo (D-08).
  const [gruposNovos, setGruposNovos] = useState<string[]>([])
  const [nomeGrupoNovo, setNomeGrupoNovo] = useState('')
  const [criandoGrupo, setCriandoGrupo] = useState(false)

  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false)
  const [recorrencia, setRecorrencia] = useState<TarefaRecorrencia>(tarefa.recorrencia)
  const [dias, setDias] = useState<number[]>(tarefa.recorrenciaDias ?? [])
  const [excluirAberto, setExcluirAberto] = useState(false)

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
      setItens((a) => [
        ...a,
        { id: r.data.id, texto, concluido: false, ordem: a.length, grupo },
      ])
      setNovoItem((n) => ({ ...n, [grupo]: '' }))
      // O grupo agora existe no banco — sai da lista local.
      setGruposNovos((g) => g.filter((x) => x !== grupo))
      router.refresh()
    })
  }

  function alternarItem(item: ItemChecklist) {
    const novo = !item.concluido
    // Otimista: marca já e desfaz se a action falhar.
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

  // Grupos do banco + os criados agora (ainda sem item).
  const grupos = agruparChecklist(itens)
  const gruposVisiveis = [
    ...grupos,
    ...gruposNovos
      .filter((n) => !grupos.some((g) => g.nome === n))
      .map((nome) => ({ nome, itens: [] as ItemChecklist[], total: 0, feitos: 0 })),
  ]

  return (
    <div className="space-y-6">
      {/* Topo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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
          <Button
            variant={concluida ? 'outline' : 'default'}
            className={concluida ? '' : 'bg-chart-success text-white hover:bg-chart-success/90'}
            disabled={salvando}
            onClick={() => salvarCampo({ status: concluida ? 'a_fazer' : 'concluida' })}
          >
            <Check className="size-4" />
            {concluida ? 'Reabrir tarefa' : 'Marcar como concluída'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações">
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
        </div>
      </div>

      {/* Código + título */}
      <div className="space-y-2">
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
            // Só salva se realmente mudou.
            if (limpo !== tarefa.titulo) salvarCampo({ titulo: limpo })
          }}
          className="h-auto border-0 px-0 text-[28px] leading-tight font-semibold shadow-none focus-visible:ring-0"
          aria-label="Título da tarefa"
        />

        {tarefa.descricao && (
          <p className="truncate text-sm text-muted-foreground">
            {tarefa.descricao.split('\n')[0]}
          </p>
        )}
      </div>

      {/* Grade de campos */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={tarefa.status}
              onValueChange={(v) => salvarCampo({ status: v as TarefaStatus })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select
              value={tarefa.responsavelId ?? NENHUM}
              onValueChange={(v) => salvarCampo({ responsavelId: v === NENHUM ? '' : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                {responsaveis.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className={`text-[10px] font-semibold ${corDoAvatar(r.id)}`}>
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

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prioridade</Label>
            <Select
              value={tarefa.prioridade}
              onValueChange={(v) => salvarCampo({ prioridade: v as TarefaPrioridade })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etiquetas</Label>
            <div className="flex flex-wrap items-center gap-1">
              {tarefa.etiquetas.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
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
            </div>
            <Input
              value={novaEtiqueta}
              onChange={(e) => setNovaEtiqueta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  adicionarEtiqueta()
                }
              }}
              placeholder="adicionar etiqueta"
              className="h-8"
              aria-label="Adicionar etiqueta"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data de início</Label>
            <Input
              type="date"
              defaultValue={tarefa.dataInicio ?? ''}
              onChange={(e) => salvarCampo({ dataInicio: e.target.value })}
              aria-label="Data de inicio"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prazo</Label>
            <Input
              type="date"
              defaultValue={tarefa.data}
              onChange={(e) => e.target.value && salvarCampo({ data: e.target.value })}
              aria-label="Prazo"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tempo estimado</Label>
            <Input
              defaultValue={tarefa.tempoEstimado ?? ''}
              onBlur={(e) => {
                if (e.target.value.trim() !== (tarefa.tempoEstimado ?? '')) {
                  salvarCampo({ tempoEstimado: e.target.value.trim() })
                }
              }}
              placeholder="4h"
              aria-label="Tempo estimado"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Projeto/Cliente</Label>
            <Select
              value={tarefa.clienteId ?? NENHUM}
              onValueChange={(v) => salvarCampo({ clienteId: v === NENHUM ? '' : v })}
            >
              <SelectTrigger className="w-full">
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
      </Card>

      {/* Conteúdo + lateral */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="detalhes">
            <TabsList>
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="checklists">Checklists ({itens.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Descrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    onBlur={() => {
                      if (descricao !== (tarefa.descricao ?? '')) salvarCampo({ descricao })
                    }}
                    rows={8}
                    placeholder="Detalhes, contexto, links..."
                    className="whitespace-pre-wrap"
                    aria-label="Descrição da tarefa"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklists" className="mt-4 space-y-4">
              {gruposVisiveis.length === 0 && !criandoGrupo && (
                <p className="text-sm text-muted-foreground">Nenhum checklist ainda.</p>
              )}

              {gruposVisiveis.map((grupo) => (
                <Card key={grupo.nome}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{grupo.nome}</CardTitle>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {grupo.feitos}/{grupo.total}
                      </span>
                    </div>
                    <Progress
                      value={progressoChecklist(grupo.feitos, grupo.total)}
                      className="h-1.5"
                    />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {grupo.itens.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={item.concluido}
                          onCheckedChange={() => alternarItem(item)}
                          aria-label={item.texto}
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
                          className="size-7"
                          onClick={() => removerItem(item)}
                          aria-label={`Remover ${item.texto}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <Input
                        value={novoItem[grupo.nome] ?? ''}
                        onChange={(e) =>
                          setNovoItem((n) => ({ ...n, [grupo.nome]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            adicionarItem(grupo.nome)
                          }
                        }}
                        placeholder="Adicionar item..."
                        aria-label={`Novo item em ${grupo.nome}`}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => adicionarItem(grupo.nome)}
                        disabled={salvando}
                      >
                        <Plus className="size-4" />
                        Adicionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {criandoGrupo ? (
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
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setCriandoGrupo(true)}
                >
                  <Plus className="size-4" />
                  Adicionar checklist
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Lateral: SÓ Notas — o resto do mockup ficou fora do escopo (D-12). */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={notas}
                onChange={(e) => {
                  setNotas(e.target.value)
                  setNotasSalvas(false)
                }}
                onBlur={() => {
                  if (notas !== (tarefa.notas ?? '')) {
                    salvarCampo({ notas }, () => setNotasSalvas(true))
                  }
                }}
                rows={8}
                placeholder="Anotações rápidas..."
                aria-label="Notas da tarefa"
              />
              {notasSalvas && (
                <p className="text-xs text-muted-foreground">Salvo agora há pouco</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recorrência (D-09): vive no "..." — a série não pode sumir. */}
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
              <Select
                value={recorrencia}
                onValueChange={(v) => setRecorrencia(v as TarefaRecorrencia)}
              >
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
