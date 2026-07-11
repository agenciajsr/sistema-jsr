import { Users2 } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

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
