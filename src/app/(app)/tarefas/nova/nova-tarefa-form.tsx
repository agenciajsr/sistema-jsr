'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUp,
  Bold,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  History,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  StickyNote,
  Trash2,
  Underline,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  aplicarMarcacao,
  corDoAvatar,
  iniciais,
  type TipoMarcacao,
} from '@/lib/tarefas/quadro'
import { criarTarefa } from '@/actions/tarefas'

// D-05: página cheia com a MESMA estrutura visual do detalhe. Os campos ligam a
// useState (não há tarefa ainda); as 3 abas que dependem de uma tarefa salva
// aparecem DESABILITADAS com aviso — aba desabilitada não é botão morto.

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

// Mesmas classes da grade do detalhe — é o mesmo desenho.
const SELECT_CELULA = 'h-auto w-full border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0'
const DATA_CELULA = 'h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
const ABA_CELULA =
  'gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none disabled:opacity-50 disabled:cursor-not-allowed'

const FERRAMENTAS: { tipo: TipoMarcacao; Icone: LucideIcon; rotulo: string }[] = [
  { tipo: 'negrito', Icone: Bold, rotulo: 'Negrito' },
  { tipo: 'italico', Icone: Italic, rotulo: 'Itálico' },
  { tipo: 'sublinhado', Icone: Underline, rotulo: 'Sublinhado' },
  { tipo: 'lista', Icone: List, rotulo: 'Lista' },
  { tipo: 'lista_numerada', Icone: ListOrdered, rotulo: 'Lista numerada' },
  { tipo: 'checkbox', Icone: CheckSquare, rotulo: 'Caixa de seleção' },
  { tipo: 'link', Icone: LinkIcon, rotulo: 'Link' },
]

type ItemNovo = { id: string; texto: string }

export function NovaTarefaForm({
  clientes,
  responsaveis,
  statusInicial,
  dataInicial,
}: {
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  statusInicial: TarefaStatus
  dataInicial: string
}) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(dataInicial)
  const [dataInicio, setDataInicio] = useState('')
  const [clienteId, setClienteId] = useState<string>(NENHUM)
  const [responsavelId, setResponsavelId] = useState<string>(NENHUM)
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media')
  const [status, setStatus] = useState<TarefaStatus>(statusInicial)
  const [tempoEstimado, setTempoEstimado] = useState('')
  const [etiquetasTexto, setEtiquetasTexto] = useState('')
  const [recorrencia, setRecorrencia] = useState<TarefaRecorrencia>('nenhuma')
  const [dias, setDias] = useState<number[]>([])
  const [notas, setNotas] = useState('')
  const notasRef = useRef<HTMLTextAreaElement>(null)

  const [itens, setItens] = useState<ItemNovo[]>([])
  const [novoItem, setNovoItem] = useState('')

  function toggleDia(d: number) {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()))
  }

  function marcar(tipo: TipoMarcacao) {
    const el = notasRef.current
    if (!el) return
    const r = aplicarMarcacao(notas, el.selectionStart, el.selectionEnd, tipo)
    setNotas(r.texto)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(r.cursor, r.cursor)
    })
  }

  function adicionarItem() {
    const texto = novoItem.trim()
    if (!texto) return
    setItens((a) => [...a, { id: `tmp-${Date.now()}-${a.length}`, texto }])
    setNovoItem('')
  }

  function salvar() {
    if (!titulo.trim()) {
      toast.error('Informe o titulo da tarefa.')
      return
    }
    if (recorrencia === 'personalizada' && dias.length === 0) {
      toast.error('Escolha ao menos um dia da semana.')
      return
    }

    startSalvar(async () => {
      const r = await criarTarefa({
        titulo: titulo.trim(),
        notas: notas.trim(),
        descricao: descricao.trim(),
        data,
        dataInicio,
        clienteId: clienteId === NENHUM ? '' : clienteId,
        responsavelId: responsavelId === NENHUM ? '' : responsavelId,
        prioridade,
        status,
        tempoEstimado: tempoEstimado.trim(),
        etiquetas: etiquetasTexto
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
        recorrencia,
        recorrenciaDias: dias,
        checklist: itens.map((i) => ({ texto: i.texto, grupo: 'Checklist' })),
      })

      if ('error' in r) {
        toast.error(r.error)
        return
      }

      toast.success(recorrencia === 'nenhuma' ? 'Tarefa criada.' : 'Tarefa recorrente criada.')
      // D-11: vai para o detalhe da tarefa recém-criada (é lá que se anexa/comenta).
      router.push(`/tarefas/${r.data.id}`)
    })
  }

  return (
    <div className="space-y-6">
      {/* Barra superior — mesma faixa branca de ponta a ponta do detalhe */}
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
            <span>Nova Tarefa</span>
          </div>
        </div>

        <Button onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Criar tarefa'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna esquerda */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="gap-4 py-5">
            <CardHeader className="flex items-center justify-between space-y-0">
              <Badge variant="secondary">Nova</Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título da tarefa"
                  autoFocus
                  className="h-auto border-0 px-0 text-[26px] leading-tight font-semibold shadow-none focus-visible:ring-0"
                  aria-label="Título da tarefa"
                />
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  placeholder="Descrição breve..."
                  className="resize-none border-0 px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
                  aria-label="Descrição da tarefa"
                />
              </div>

              {/* A MESMA grade de 8 células com divisórias do detalhe */}
              <div className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card md:grid-cols-4">
                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TarefaStatus)}>
                    <SelectTrigger className={SELECT_CELULA}>
                      <Badge variant="outline" className={STATUS_CLASSE[status]}>
                        {status === 'em_andamento' && <Play className="size-3 fill-current" />}
                        {STATUS_LABEL[status]}
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
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
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
                    value={prioridade}
                    onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}
                  >
                    <SelectTrigger className={SELECT_CELULA}>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {(prioridade === 'alta' || prioridade === 'urgente') && (
                          <ArrowUp className="size-3.5 text-destructive" />
                        )}
                        {PRIORIDADE_LABEL[prioridade]}
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
                  <Input
                    value={etiquetasTexto}
                    onChange={(e) => setEtiquetasTexto(e.target.value)}
                    placeholder="tráfego, urgente"
                    className="h-auto border-0 px-0 text-sm shadow-none focus-visible:ring-0"
                    aria-label="Etiquetas separadas por vírgula"
                  />
                </div>

                <div className="space-y-1.5 p-3">
                  <Label className="text-xs text-muted-foreground">Data de início</Label>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
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
                      value={data}
                      onChange={(e) => setData(e.target.value)}
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
                      value={tempoEstimado}
                      onChange={(e) => setTempoEstimado(e.target.value)}
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
                    <Select value={clienteId} onValueChange={setClienteId}>
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

          {/* Mesmas 5 abas do detalhe — 3 desabilitadas com aviso (D-05) */}
          <Tabs defaultValue="detalhes">
            <TabsList className="h-auto w-full justify-start gap-4 rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="detalhes" className={ABA_CELULA}>
                <FileText className="size-4" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="checklists" className={ABA_CELULA}>
                <ListChecks className="size-4" />
                Checklists{itens.length > 0 && ` ${itens.length}`}
              </TabsTrigger>
              <TabsTrigger value="anexos" className={ABA_CELULA} disabled title="Disponível após salvar a tarefa">
                <Paperclip className="size-4" />
                Anexos
              </TabsTrigger>
              <TabsTrigger value="comentarios" className={ABA_CELULA} disabled title="Disponível após salvar a tarefa">
                <MessageSquare className="size-4" />
                Comentários
              </TabsTrigger>
              <TabsTrigger value="atividade" className={ABA_CELULA} disabled title="Disponível após salvar a tarefa">
                <History className="size-4" />
                Atividade
              </TabsTrigger>
            </TabsList>

            {/* Detalhes: Descrição + Recorrência */}
            <TabsContent value="detalhes" className="mt-4 space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Descrição</h3>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={6}
                  placeholder="Detalhes, contexto, links..."
                  aria-label="Descrição completa"
                />
              </div>

              {/* Recorrência: a série NÃO pode sumir da tela de criação. */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Recorrência</h3>
                <Select
                  value={recorrencia}
                  onValueChange={(v) => setRecorrencia(v as TarefaRecorrencia)}
                >
                  <SelectTrigger className="w-full sm:w-72">
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

                {recorrencia === 'personalizada' && (
                  <div className="flex gap-1.5 pt-1">
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

                {recorrencia !== 'nenhuma' && (
                  <p className="text-xs text-muted-foreground">
                    Cada ocorrência recebe a própria cópia dos itens do checklist, marcável por dia.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Checklists: montado localmente, enviado no criarTarefa */}
            <TabsContent value="checklists" className="mt-4 space-y-3">
              {itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {itens.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <Checkbox disabled aria-label={item.texto} />
                      <span className="flex-1 text-sm">{item.texto}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setItens((a) => a.filter((i) => i.id !== item.id))}
                        aria-label={`Remover ${item.texto}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 pt-1">
                <Input
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      adicionarItem()
                    }
                  }}
                  placeholder="Adicionar item..."
                  aria-label="Novo item do checklist"
                />
                <Button type="button" variant="secondary" onClick={adicionarItem}>
                  <Plus className="size-4" />
                  Adicionar item
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Coluna direita: SÓ Notas (D-05) — Anexos/Atividade seriam cascas vazias */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <StickyNote className="size-4 text-muted-foreground" />
                Notas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-0.5 rounded-md border p-1">
                {FERRAMENTAS.map(({ tipo, Icone, rotulo }) => (
                  <Button
                    key={tipo}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => marcar(tipo)}
                    aria-label={rotulo}
                    title={rotulo}
                  >
                    <Icone className="size-3.5" />
                  </Button>
                ))}
              </div>
              <Textarea
                ref={notasRef}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={8}
                placeholder="Anotações rápidas..."
                aria-label="Notas da tarefa"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
