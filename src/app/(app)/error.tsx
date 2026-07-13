'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Error boundary do grupo (app). Captura falhas de renderização das páginas
// logadas — em especial o timeout de revalidação de sessão (getCurrentUser)
// durante um soluço/incidente do Supabase. Em vez de congelar a função
// serverless até os 300s da Vercel (ou jogar o usuário logado num loop de
// login), mostramos uma mensagem clara com opção de recarregar.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Sistema instável no momento
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Não conseguimos validar sua sessão agora — pode ser uma instabilidade
          temporária do servidor. Recarregue a página para tentar de novo.
        </p>
      </div>
      <Button onClick={reset} className="gap-1.5">
        <RefreshCw className="size-4" />
        Recarregar
      </Button>
    </div>
  )
}
