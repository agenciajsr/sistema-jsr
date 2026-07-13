import { Wrench } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

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
