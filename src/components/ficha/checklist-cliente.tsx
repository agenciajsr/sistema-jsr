'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

type ChecklistItem = {
  id: string
  tarefa: string
  frequencia: 'diária' | 'semanal' | 'mensal'
  feito: boolean
}

// Checklist interativo em estado LOCAL (mesma mecânica da página /checklist):
// marca/desmarca não persiste — a persistência real vem em incremento futuro.
export function ChecklistCliente({ itens }: { itens: ChecklistItem[] }) {
  const [estado, setEstado] = useState<ChecklistItem[]>(itens)

  if (estado.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum item de checklist para este cliente.
      </p>
    )
  }

  function alternar(id: string) {
    setEstado((atual) =>
      atual.map((item) =>
        item.id === id ? { ...item, feito: !item.feito } : item,
      ),
    )
  }

  return (
    <ul className="space-y-2">
      {estado.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-lg border bg-background p-3"
        >
          <Checkbox
            id={`checklist-${item.id}`}
            checked={item.feito}
            onCheckedChange={() => alternar(item.id)}
          />
          <label
            htmlFor={`checklist-${item.id}`}
            className={`flex-1 cursor-pointer text-sm ${
              item.feito ? 'text-muted-foreground line-through' : ''
            }`}
          >
            {item.tarefa}
          </label>
          <Badge variant="secondary" className="shrink-0 capitalize">
            {item.frequencia}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
