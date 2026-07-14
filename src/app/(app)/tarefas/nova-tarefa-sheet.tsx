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
import { COLUNAS_ORDEM } from '@/lib/tarefas/quadro'
import { criarTarefa } from '@/actions/tarefas'

// ⚠️ Sheet, NUNCA Dialog: o componente `dialog` do shadcn não está instalado
// neste repo e não deve ser adicionado (mesmo precedente do ContratoForm).
//
// D-11: este sheet SÓ CRIA. A edição inteira mora em /tarefas/[id].

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

/** Valor sentinela do Select: o Radix não aceita SelectItem com value="". */
const NENHUM = '__nenhum__'

type ItemNovo = { id: string; texto: string }

export function NovaTarefaSheet({
  aberto,
  onOpenChange,
  clientes,
  responsaveis,
  dataPadrao,
  statusPadrao,
}: {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  /** Data pré-preenchida (o início do intervalo que o usuário está olhando). */
  dataPadrao: string
  /** A coluna que chamou o "+ Adicionar tarefa" — a tarefa já nasce nela. */
  statusPadrao: TarefaStatus
}) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(dataPadrao)
  const [dataInicio, setDataInicio] = useState('')
  const [clienteId, setClienteId] = useState<string>(NENHUM)
  const [responsavelId, setResponsavelId] = useState<string>(NENHUM)
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media')
  const [status, setStatus] = useState<TarefaStatus>(statusPadrao)
  const [tempoEstimado, setTempoEstimado] = useState('')
  const [etiquetasTexto, setEtiquetasTexto] = useState('')
  const [recorrencia, setRecorrencia] = useState<TarefaRecorrencia>('nenhuma')
  const [dias, setDias] = useState<number[]>([])

  // Os itens vivem em useState e vão junto no criarTarefa (ainda não há tarefa).
  const [itens, setItens] = useState<ItemNovo[]>([])
  const [novoItem, setNovoItem] = useState('')

  // Sincroniza o form ao abrir (a coluna/data de origem pode ter mudado).
  useEffect(() => {
    if (!aberto) return
    setTitulo('')
    setDescricao('')
    setData(dataPadrao)
    setDataInicio('')
    setClienteId(NENHUM)
    setResponsavelId(NENHUM)
    setPrioridade('media')
    setStatus(statusPadrao)
    setTempoEstimado('')
    setEtiquetasTexto('')
    setRecorrencia('nenhuma')
    setDias([])
    setItens([])
    setNovoItem('')
  }, [aberto, dataPadrao, statusPadrao])

  function toggleDia(d: number) {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()))
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
        // D-08: na criação todos os itens caem no grupo padrão.
        checklist: itens.map((i) => ({ texto: i.texto, grupo: 'Checklist' })),
      })

      if ('error' in r) {
        toast.error(r.error)
        return
      }

      toast.success(recorrencia === 'nenhuma' ? 'Tarefa criada.' : 'Tarefa recorrente criada.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nova tarefa</SheetTitle>
          <SheetDescription>
            Crie uma tarefa avulsa ou recorrente, com checklist proprio.
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
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes, contexto, links..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data de início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Prazo</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}>
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

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TarefaStatus)}>
                <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tempo">Tempo estimado</Label>
              <Input
                id="tempo"
                value={tempoEstimado}
                onChange={(e) => setTempoEstimado(e.target.value)}
                placeholder="4h"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="etiquetas">Etiquetas</Label>
              <Input
                id="etiquetas"
                value={etiquetasTexto}
                onChange={(e) => setEtiquetasTexto(e.target.value)}
                placeholder="tráfego, urgente"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Recorrência</Label>
            <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as TarefaRecorrencia)}>
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
          </div>

          <div className="space-y-2">
            <Label>Checklist</Label>

            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {itens.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
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
                Adicionar
              </Button>
            </div>

            {recorrencia !== 'nenhuma' && (
              <p className="text-xs text-muted-foreground">
                Cada ocorrência recebe a própria cópia destes itens, marcável por dia.
              </p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Criar tarefa'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
