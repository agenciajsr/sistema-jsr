'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  STATUS_LABEL,
  PRIORIDADE_LABEL,
  somaDias,
  type TarefaPrioridade,
  type TarefaStatus,
} from '@/lib/tarefas/recorrencia'
import type { TarefaCard, TarefasDoDia } from '@/lib/tarefas/dados'
import { atualizarTarefa } from '@/actions/tarefas'
import { TarefaSheet } from './tarefa-sheet'

// Cores semânticas já definidas em globals.css.
const PRIORIDADE_CLASSE: Record<TarefaPrioridade, string> = {
  urgente: 'bg-destructive text-white',
  alta: 'bg-chart-warning text-white',
  media: '',
  baixa: '',
}

const PRIORIDADE_VARIANTE: Record<TarefaPrioridade, 'default' | 'secondary' | 'outline'> = {
  urgente: 'default',
  alta: 'default',
  media: 'secondary',
  baixa: 'outline',
}

/** Rótulo do dia. Toda a aritmética é feita sobre a STRING 'YYYY-MM-DD',
 *  ancorada no `hoje` que veio de hojeBrasilia() no servidor — nunca com
 *  new Date() do browser, que usa o fuso da máquina do usuário. */
function rotuloDoDia(dia: string, hoje: string): string {
  if (dia === hoje) return 'Hoje'
  if (dia === somaDias(hoje, -1)) return 'Ontem'
  if (dia === somaDias(hoje, 1)) return 'Amanhã'
  return format(new Date(`${dia}T12:00:00Z`), "dd 'de' MMMM", { locale: ptBR })
}

function TarefaItem({
  tarefa,
  onAbrir,
}: {
  tarefa: TarefaCard
  onAbrir: (t: TarefaCard) => void
}) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const concluida = tarefa.status === 'concluida'
  const naoRealizada = tarefa.status === 'nao_realizada'

  function alternarConclusao() {
    startTransition(async () => {
      const r = await atualizarTarefa(tarefa.id, {
        status: concluida ? 'a_fazer' : 'concluida',
      })
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card
      onClick={() => onAbrir(tarefa)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onAbrir(tarefa)
      }}
      tabIndex={0}
      className="flex cursor-pointer flex-row items-center gap-3 p-3 hover:bg-muted/40"
    >
      {/* stopPropagation: marcar a tarefa não pode abrir o sheet. */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={concluida}
          onCheckedChange={alternarConclusao}
          disabled={pendente}
          aria-label={concluida ? `Reabrir ${tarefa.titulo}` : `Concluir ${tarefa.titulo}`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={
              concluida || naoRealizada
                ? 'truncate text-sm text-muted-foreground line-through'
                : 'truncate text-sm font-medium'
            }
          >
            {tarefa.titulo}
          </span>
          {tarefa.tarefaMaeId && (
            <Repeat
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="Tarefa recorrente"
            />
          )}
        </div>

        {(tarefa.clienteNome || tarefa.responsavelNome || tarefa.checklistTotal > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {tarefa.clienteNome && <span className="truncate">{tarefa.clienteNome}</span>}
            {tarefa.responsavelNome && <span className="truncate">{tarefa.responsavelNome}</span>}
            {tarefa.checklistTotal > 0 && (
              <span className="tabular-nums">
                {tarefa.checklistConcluidos}/{tarefa.checklistTotal}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {naoRealizada && <Badge variant="outline">Não realizada</Badge>}
        {!concluida && !naoRealizada && (
          <>
            <Badge
              variant={PRIORIDADE_VARIANTE[tarefa.prioridade]}
              className={PRIORIDADE_CLASSE[tarefa.prioridade]}
            >
              {PRIORIDADE_LABEL[tarefa.prioridade]}
            </Badge>
            {tarefa.status === 'em_andamento' && (
              <Badge variant="outline">{STATUS_LABEL.em_andamento}</Badge>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function Bloco({
  titulo,
  tarefas,
  onAbrir,
  className,
}: {
  titulo: string
  tarefas: TarefaCard[]
  onAbrir: (t: TarefaCard) => void
  className?: string
}) {
  if (tarefas.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className={className ?? 'text-sm font-semibold text-muted-foreground'}>
        {titulo} ({tarefas.length})
      </h2>
      <div className="space-y-2">
        {tarefas.map((t) => (
          <TarefaItem key={t.id} tarefa={t} onAbrir={onAbrir} />
        ))}
      </div>
    </section>
  )
}

export function TarefasLista({
  dados,
  clientes,
  responsaveis,
}: {
  dados: TarefasDoDia
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<TarefaCard | undefined>(undefined)

  const rotulo = rotuloDoDia(dados.dia, dados.hoje)
  const ehHoje = dados.dia === dados.hoje
  // "Atrasada" só faz sentido olhando para hoje: num dia passado o conceito confunde.
  const mostrarAtrasadas = ehHoje && dados.atrasadas.length > 0
  const vazio =
    dados.doDia.length === 0 && dados.concluidas.length === 0 && !mostrarAtrasadas

  function irPara(dia: string) {
    router.push(dia === dados.hoje ? '/tarefas' : `/tarefas?dia=${dia}`)
  }

  function abrirNova() {
    setEmEdicao(undefined)
    setAberto(true)
  }

  function abrirTarefa(t: TarefaCard) {
    setEmEdicao(t)
    setAberto(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-semibold">Tarefas</h1>
        <Button onClick={abrirNova}>Nova Tarefa</Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => irPara(somaDias(dados.dia, -1))}
          aria-label="Dia anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="min-w-[9rem] text-center text-sm font-medium">
          {rotulo}
          {!ehHoje && (
            <span className="ml-1.5 text-muted-foreground">
              {format(new Date(`${dados.dia}T12:00:00Z`), 'dd/MM', { locale: ptBR })}
            </span>
          )}
        </span>

        <Button
          variant="outline"
          size="icon"
          onClick={() => irPara(somaDias(dados.dia, 1))}
          aria-label="Próximo dia"
        >
          <ChevronRight className="size-4" />
        </Button>

        {!ehHoje && (
          <Button variant="ghost" size="sm" onClick={() => irPara(dados.hoje)}>
            Hoje
          </Button>
        )}
      </div>

      {vazio ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-[20px] leading-tight font-semibold">
            {ehHoje ? 'Nada para hoje 🎉' : 'Nada para este dia'}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Aproveite — ou crie uma tarefa para não esquecer.
          </p>
          <Button onClick={abrirNova}>Nova Tarefa</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {mostrarAtrasadas && (
            <Bloco
              titulo="Atrasadas"
              tarefas={dados.atrasadas}
              onAbrir={abrirTarefa}
              className="text-sm font-semibold text-destructive"
            />
          )}
          <Bloco titulo={rotulo} tarefas={dados.doDia} onAbrir={abrirTarefa} />
          <Bloco titulo="Concluídas" tarefas={dados.concluidas} onAbrir={abrirTarefa} />
        </div>
      )}

      <TarefaSheet
        aberto={aberto}
        onOpenChange={setAberto}
        tarefa={emEdicao}
        clientes={clientes}
        responsaveis={responsaveis}
        diaPadrao={dados.dia}
      />
    </div>
  )
}
