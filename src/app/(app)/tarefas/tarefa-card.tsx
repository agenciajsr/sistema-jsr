'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Repeat } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { atualizarTarefa } from '@/actions/tarefas'
import type { TarefaCard as TarefaCardTipo } from '@/lib/tarefas/dados'
import { PRIORIDADE_LABEL } from '@/lib/tarefas/recorrencia'
import {
  PRIORIDADE_CLASSE,
  corDoAvatar,
  iniciais,
  progressoChecklist,
} from '@/lib/tarefas/quadro'

/** 'YYYY-MM-DD' → 'dd/MM', direto da string: `new Date()` no browser mudaria
 *  o dia conforme o fuso da máquina do usuário. */
function diaEMes(data: string): string {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

export function TarefaCard({ tarefa }: { tarefa: TarefaCardTipo }) {
  const router = useRouter()
  const [salvando, startSalvar] = useTransition()

  const riscado = tarefa.status === 'concluida' || tarefa.status === 'nao_realizada'
  const concluida = tarefa.status === 'concluida'

  function alternarConclusao() {
    startSalvar(async () => {
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
    <Card className="gap-0 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-2.5">
        {/* stopPropagation + preventDefault: marcar a tarefa NUNCA pode navegar. */}
        <div
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          className="pt-0.5"
        >
          <Checkbox
            checked={concluida}
            onCheckedChange={alternarConclusao}
            disabled={salvando}
            aria-label={concluida ? `Reabrir ${tarefa.titulo}` : `Concluir ${tarefa.titulo}`}
          />
        </div>

        <Link href={`/tarefas/${tarefa.id}`} className="min-w-0 flex-1">
          <p
            className={
              riscado
                ? 'truncate text-sm font-medium text-muted-foreground line-through'
                : 'truncate text-sm font-medium'
            }
            title={tarefa.titulo}
          >
            {tarefa.titulo}
          </p>

          {tarefa.clienteNome && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Cliente: {tarefa.clienteNome}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {diaEMes(tarefa.data)}
            </span>

            <Badge variant="outline" className={PRIORIDADE_CLASSE[tarefa.prioridade]}>
              {PRIORIDADE_LABEL[tarefa.prioridade]}
            </Badge>

            {/* Sinal de recorrente: o mockup não mostra, mas a série não pode
                sumir da vista (D-09). */}
            {tarefa.tarefaMaeId && (
              <Repeat className="size-3.5 text-muted-foreground" aria-label="Tarefa recorrente" />
            )}
          </div>
        </Link>

        {tarefa.responsavelId && (
          <Avatar size="sm" className="shrink-0" title={tarefa.responsavelNome ?? undefined}>
            <AvatarFallback className={`text-[10px] font-semibold ${corDoAvatar(tarefa.responsavelId)}`}>
              {iniciais(tarefa.responsavelNome)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {tarefa.checklistTotal > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Progress
            value={progressoChecklist(tarefa.checklistConcluidos, tarefa.checklistTotal)}
            className="h-1"
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {progressoChecklist(tarefa.checklistConcluidos, tarefa.checklistTotal)}%
          </span>
        </div>
      )}
    </Card>
  )
}
