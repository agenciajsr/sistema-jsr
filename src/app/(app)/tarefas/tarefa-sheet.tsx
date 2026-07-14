'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import type { TarefaCard } from '@/lib/tarefas/dados'
import {
  criarTarefa,
  atualizarTarefa,
  atualizarRecorrencia,
  deletarTarefa,
  addChecklistItemTarefa,
  toggleChecklistItemTarefa,
  deleteChecklistItemTarefa,
  getChecklistDaTarefa,
} from '@/actions/tarefas'

// ⚠️ Sheet, NUNCA Dialog: o componente `dialog` do shadcn não está instalado
// neste repo e não deve ser adicionado (mesmo precedente do ContratoForm).

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

const STATUS: TarefaStatus[] = ['a_fazer', 'em_andamento', 'concluida', 'nao_realizada']

/** Valor sentinela do Select: o Radix não aceita SelectItem com value="". */
const NENHUM = '__nenhum__'

type ItemChecklist = { id: string; texto: string; concluido: boolean }

export function TarefaSheet({
  aberto,
  onOpenChange,
  tarefa,
  clientes,
  responsaveis,
  diaPadrao,
}: {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  /** Ausente = criação. Presente = edição. */
  tarefa?: TarefaCard
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  /** Data pré-preenchida na criação (o dia que o usuário está olhando). */
  diaPadrao: string
}) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()
  const editando = Boolean(tarefa)

  const [titulo, setTitulo] = useState('')
  const [notas, setNotas] = useState('')
  const [data, setData] = useState(diaPadrao)
  const [clienteId, setClienteId] = useState<string>(NENHUM)
  const [responsavelId, setResponsavelId] = useState<string>(NENHUM)
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media')
  const [status, setStatus] = useState<TarefaStatus>('a_fazer')
  const [recorrencia, setRecorrencia] = useState<TarefaRecorrencia>('nenhuma')
  const [dias, setDias] = useState<number[]>([])

  // Criação: os itens vivem em useState e vão junto no criarTarefa.
  // Edição: são carregados sob demanda (só quando o sheet abre) e cada ação
  // chama a Server Action correspondente. Carregar aqui — em vez de trazer os
  // itens de TODAS as tarefas na query da página — mantém a listagem barata.
  const [itens, setItens] = useState<ItemChecklist[]>([])
  const [novoItem, setNovoItem] = useState('')
  const [carregandoItens, setCarregandoItens] = useState(false)

  // Sincroniza o form ao abrir (e ao trocar de tarefa).
  useEffect(() => {
    if (!aberto) return

    setTitulo(tarefa?.titulo ?? '')
    setNotas(tarefa?.notas ?? '')
    setData(tarefa?.data ?? diaPadrao)
    setClienteId(tarefa?.clienteId ?? NENHUM)
    setResponsavelId(tarefa?.responsavelId ?? NENHUM)
    setPrioridade(tarefa?.prioridade ?? 'media')
    setStatus(tarefa?.status ?? 'a_fazer')
    setRecorrencia(tarefa?.recorrencia ?? 'nenhuma')
    setDias(tarefa?.recorrenciaDias ?? [])
    setNovoItem('')
    setItens([])

    if (!tarefa) return

    let cancelado = false
    setCarregandoItens(true)
    getChecklistDaTarefa(tarefa.id)
      .then((r) => {
        if (cancelado) return
        const carregados = 'data' in r ? r.data : undefined
        if (carregados) {
          setItens(carregados.map((i) => ({ id: i.id, texto: i.texto, concluido: i.concluido })))
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoItens(false)
      })

    return () => {
      cancelado = true
    }
  }, [aberto, tarefa, diaPadrao])

  const ehOcorrencia = Boolean(tarefa?.tarefaMaeId)

  function toggleDia(d: number) {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()))
  }

  function fechar() {
    onOpenChange(false)
    router.refresh()
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
      const base = {
        titulo: titulo.trim(),
        notas: notas.trim(),
        data,
        clienteId: clienteId === NENHUM ? '' : clienteId,
        responsavelId: responsavelId === NENHUM ? '' : responsavelId,
        prioridade,
      }

      if (!editando) {
        const r = await criarTarefa({
          ...base,
          recorrencia,
          recorrenciaDias: dias,
          checklist: itens.map((i) => i.texto),
        })
        if ('error' in r) {
          toast.error(r.error)
          return
        }
        toast.success(
          recorrencia === 'nenhuma' ? 'Tarefa criada.' : 'Tarefa recorrente criada.'
        )
        fechar()
        return
      }

      const r = await atualizarTarefa(tarefa!.id, { ...base, status })
      if ('error' in r) {
        toast.error(r.error)
        return
      }

      // A recorrência tem action própria: ela resolve o alvo (molde) sozinha.
      if (recorrencia !== tarefa!.recorrencia || ehOcorrencia) {
        const rr = await atualizarRecorrencia(tarefa!.id, {
          recorrencia,
          recorrenciaDias: dias,
        })
        if ('error' in rr) {
          toast.error(rr.error)
          return
        }
      }

      toast.success('Tarefa salva.')
      fechar()
    })
  }

  function encerrarSerie() {
    if (!tarefa) return
    startSalvar(async () => {
      const r = await atualizarRecorrencia(tarefa.id, {
        recorrencia: tarefa.recorrencia === 'nenhuma' ? 'nenhuma' : tarefa.recorrencia,
        recorrenciaDias: dias,
        ativa: false,
      })
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Recorrencia encerrada. Nenhuma nova ocorrencia sera criada.')
      fechar()
    })
  }

  function excluir() {
    if (!tarefa) return
    startSalvar(async () => {
      const r = await deletarTarefa(tarefa.id)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Tarefa excluida.')
      fechar()
    })
  }

  function adicionarItem() {
    const texto = novoItem.trim()
    if (!texto) return

    if (!editando) {
      // Ainda não existe tarefa: o item vive só no estado até o criarTarefa.
      setItens((a) => [...a, { id: `tmp-${Date.now()}-${a.length}`, texto, concluido: false }])
      setNovoItem('')
      return
    }

    startSalvar(async () => {
      const r = await addChecklistItemTarefa(tarefa!.id, texto)
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      setItens((a) => [...a, { id: r.data.id, texto, concluido: false }])
      setNovoItem('')
    })
  }

  function alternarItem(item: ItemChecklist) {
    const novo = !item.concluido
    setItens((a) => a.map((i) => (i.id === item.id ? { ...i, concluido: novo } : i)))
    if (!editando) return

    startSalvar(async () => {
      const r = await toggleChecklistItemTarefa(item.id, novo)
      if ('error' in r) {
        toast.error(r.error)
        // Desfaz o otimismo se a action falhar.
        setItens((a) => a.map((i) => (i.id === item.id ? { ...i, concluido: !novo } : i)))
      }
    })
  }

  function removerItem(item: ItemChecklist) {
    setItens((a) => a.filter((i) => i.id !== item.id))
    if (!editando) return

    startSalvar(async () => {
      const r = await deleteChecklistItemTarefa(item.id)
      if ('error' in r) toast.error(r.error)
    })
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editando ? 'Editar tarefa' : 'Nova tarefa'}</SheetTitle>
          <SheetDescription>
            {editando
              ? 'Altere os dados, o checklist e a recorrencia desta tarefa.'
              : 'Crie uma tarefa avulsa ou recorrente, com checklist proprio.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisar contas de anúncio"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalhes, contexto, links..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_ORDEM.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDADE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Nenhum</SelectItem>
                  {responsaveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {editando && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TarefaStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Recorrência</Label>
            <Select
              value={recorrencia}
              onValueChange={(v) => setRecorrencia(v as TarefaRecorrencia)}
            >
              <SelectTrigger>
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

            {editando && ehOcorrencia && (
              <p className="text-xs text-muted-foreground">
                Alterar a recorrência afeta toda a série.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Checklist</Label>

            {carregandoItens ? (
              <p className="text-sm text-muted-foreground">Carregando itens...</p>
            ) : itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {itens.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
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
                Adicionar
              </Button>
            </div>

            {!editando && recorrencia !== 'nenhuma' && (
              <p className="text-xs text-muted-foreground">
                Cada ocorrência recebe a própria cópia destes itens, marcável por dia.
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>

          {editando && (
            <div className="flex gap-2">
              {(ehOcorrencia || tarefa!.recorrencia !== 'nenhuma') && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={encerrarSerie}
                  disabled={salvando}
                >
                  Encerrar recorrência
                </Button>
              )}
              <Button
                variant="ghost"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={excluir}
                disabled={salvando}
              >
                Excluir
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
