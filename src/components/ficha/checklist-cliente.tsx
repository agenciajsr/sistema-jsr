'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from '@/actions/checklist'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

type Frequencia = 'diaria' | 'semanal' | 'mensal'

type ChecklistItem = {
  id: string
  tarefa: string
  frequencia: Frequencia
  concluido: boolean
}

const FREQUENCIA_LABEL: Record<Frequencia, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

export function ChecklistCliente({
  clienteId,
  itens,
}: {
  clienteId: string
  itens: ChecklistItem[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tarefa, setTarefa] = useState('')
  const [frequencia, setFrequencia] = useState<Frequencia>('semanal')

  function handleToggle(item: ChecklistItem) {
    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, clienteId, !item.concluido)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteChecklistItem(id, clienteId)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Item removido.')
      router.refresh()
    })
  }

  function handleAdd() {
    const limpo = tarefa.trim()
    if (!limpo) {
      toast.error('Informe a tarefa do checklist.')
      return
    }
    startTransition(async () => {
      const result = await addChecklistItem(clienteId, limpo, frequencia)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Item adicionado.')
      setTarefa('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum item de checklist para este cliente.
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border bg-background p-3"
            >
              <Checkbox
                id={`checklist-${item.id}`}
                checked={item.concluido}
                disabled={isPending}
                onCheckedChange={() => handleToggle(item)}
              />
              <label
                htmlFor={`checklist-${item.id}`}
                className={`flex-1 cursor-pointer text-sm ${
                  item.concluido ? 'text-muted-foreground line-through' : ''
                }`}
              >
                {item.tarefa}
              </label>
              <Badge variant="secondary" className="shrink-0">
                {FREQUENCIA_LABEL[item.frequencia]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={() => handleDelete(item.id)}
                aria-label="Excluir item"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-center">
        <Input
          value={tarefa}
          onChange={(e) => setTarefa(e.target.value)}
          placeholder="Nova tarefa do checklist"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <select
          value={frequencia}
          onChange={(e) => setFrequencia(e.target.value as Frequencia)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
        <Button type="button" onClick={handleAdd} disabled={isPending}>
          <Plus className="mr-2 size-4" />
          Adicionar
        </Button>
      </div>
    </div>
  )
}
