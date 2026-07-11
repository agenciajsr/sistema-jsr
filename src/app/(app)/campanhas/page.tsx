import { Megaphone } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

export default function CampanhasPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
      <EmBreve
        titulo="Gestão de Campanhas"
        descricao="A visão consolidada de campanhas de tráfego pago (Meta e Google Ads) aparece aqui quando a integração da Fase 2 for concluída."
        icon={Megaphone}
      />
    </div>
  )
}
