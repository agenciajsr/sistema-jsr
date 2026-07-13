import { ListChecks } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

export default function TarefasPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
      <EmBreve
        titulo="Tarefas da Equipe"
        descricao="A gestão de tarefas e responsáveis do dia a dia da agência será disponibilizada nesta área."
        icon={ListChecks}
      />
    </div>
  )
}
