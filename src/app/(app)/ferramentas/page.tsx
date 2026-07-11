import { Wrench } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

export default function FerramentasPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ferramentas</h1>
      <EmBreve
        titulo="Ferramentas"
        descricao="Utilitários e automações de apoio à operação da agência serão reunidos aqui."
        icon={Wrench}
      />
    </div>
  )
}
