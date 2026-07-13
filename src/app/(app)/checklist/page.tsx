'use client'

import { useState } from 'react'
import { ListChecks } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { MockNotice } from '@/components/mock-notice'
import { StatCard } from '@/components/stat-card'
import { checklistMock } from '@/lib/mock/extra'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

const FREQ_LABEL: Record<string, string> = {
  diária: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

export default function ChecklistPage() {
  const [feitos, setFeitos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(checklistMock.map((item) => [item.id, item.feito])),
  )

  const clientes = [...new Set(checklistMock.map((item) => item.cliente))]
  const totalFeitos = Object.values(feitos).filter(Boolean).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checklist</h1>
        <p className="text-sm text-muted-foreground">
          Rotina operacional de gestão de tráfego por cliente.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo (CHK-01, adicionado ao escopo em
        2026-07-10). Marcar/desmarcar aqui não é salvo ainda — a persistência
        real depende de planejamento e implementação futura.
      </MockNotice>

      <StatCard
        label="Tarefas Concluídas Hoje"
        value={`${totalFeitos} / ${checklistMock.length}`}
        icon={ListChecks}
        color="success"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {clientes.map((cliente) => (
          <Card key={cliente} className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{cliente}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklistMock
                .filter((item) => item.cliente === cliente)
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm"
                  >
                    <Checkbox
                      checked={feitos[item.id]}
                      onCheckedChange={(checked) =>
                        setFeitos((prev) => ({ ...prev, [item.id]: checked === true }))
                      }
                    />
                    <span
                      className={
                        feitos[item.id]
                          ? 'flex-1 text-muted-foreground line-through'
                          : 'flex-1'
                      }
                    >
                      {item.tarefa}
                    </span>
                    <Badge variant="outline">{FREQ_LABEL[item.frequencia]}</Badge>
                  </label>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
