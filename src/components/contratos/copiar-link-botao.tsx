'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

// Botão pequeno da tabela /contratos: copia o link público /contrato/[token]
// para enviar ao cliente pelo WhatsApp. Feedback: toast + ícone Check por 2s.

export function CopiarLinkBotao({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    const link = `${window.location.origin}/contrato/${token}`
    await navigator.clipboard.writeText(link)
    toast.success('Link copiado')
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copiar} title="Copiar link do contrato">
      {copiado ? (
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-4" />
      )}
      <span className="sr-only">Copiar link</span>
    </Button>
  )
}
