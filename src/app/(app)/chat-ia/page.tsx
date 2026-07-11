import { Bot } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'

export default function ChatIaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Chat com IA</h1>
      <EmBreve
        titulo="Assistente com IA"
        descricao="O assistente inteligente para análises e insights sobre seus clientes está em desenvolvimento (Beta)."
        icon={Bot}
      />
    </div>
  )
}
