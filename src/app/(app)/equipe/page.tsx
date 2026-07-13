import { Users2 } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

export default function EquipePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
      <EmBreve
        titulo="Equipe JSR"
        descricao="A visão de membros, funções e alocação por cliente será apresentada nesta área."
        icon={Users2}
      />
    </div>
  )
}
