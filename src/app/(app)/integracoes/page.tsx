import { Plug } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

export default function IntegracoesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
      <EmBreve
        titulo="Integrações"
        descricao="A conexão com Meta Ads, Google Ads e demais serviços externos será configurada nesta área."
        icon={Plug}
      />
    </div>
  )
}
