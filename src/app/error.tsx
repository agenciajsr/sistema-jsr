'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

// Error boundary de RAIZ. Existe porque o error.tsx de um segmento NÃO captura
// erro lançado pelo layout do MESMO segmento (regra do App Router): quando o
// layout do grupo (app) lança (ex.: timeout de revalidação de sessão), o
// src/app/(app)/error.tsx é ignorado e, sem este arquivo, o usuário via a tela
// preta padrão do Next em inglês ("This page couldn't load") — visto em
// produção em 15/jul/2026 durante a cascata do /financeiro.
//
// Estilos standalone: este boundary renderiza DENTRO do root layout (globals.css
// e ThemeProvider presentes), então os tokens do design system funcionam — mas
// NÃO dependemos de componentes/contexto do grupo (app): botão nativo + lucide.
//
// Decisão: NÃO criamos global-error.tsx — o root layout (src/app/layout.tsx) é
// puramente estático (fontes + providers, sem async/fetch) e praticamente não
// pode falhar em runtime.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
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
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <RefreshCw className="size-4" />
        Recarregar
      </button>
    </div>
  )
}
