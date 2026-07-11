import { FileText } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
      <EmBreve
        titulo="Documentos e Arquivos"
        descricao="O repositório de contratos, briefings e materiais dos clientes ficará centralizado aqui."
        icon={FileText}
      />
    </div>
  )
}
