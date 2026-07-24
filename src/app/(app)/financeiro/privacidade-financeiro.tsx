'use client'

// Modo apresentação do /financeiro: o olho (mesma chave de privacidade do
// Painel) embaça TODOS os números da página — KPIs, tabelas e abas — sem
// alterar nenhum dado. Útil para mostrar o sistema sem expor o faturamento.

import { Eye, EyeOff } from 'lucide-react'

import { useValoresVisiveis } from '@/lib/privacidade/use-valores-visiveis'

export function BotaoOlhoValores() {
  const { visivel, alternar } = useValoresVisiveis()
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={visivel ? 'Ocultar valores' : 'Mostrar valores'}
      title={visivel ? 'Ocultar valores (modo apresentação)' : 'Mostrar valores'}
      className="inline-flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {visivel ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </button>
  )
}

export function BlocoPrivado({ children }: { children: React.ReactNode }) {
  const { visivel } = useValoresVisiveis()
  return (
    <div className={visivel ? undefined : 'blur-[6px] select-none'} aria-hidden={!visivel}>
      {children}
    </div>
  )
}
