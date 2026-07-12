import { Suspense } from 'react'

import { RelatoriosContent } from './relatorios-content'

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Relatório semanal por cliente, pronto para copiar e enviar no WhatsApp.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando...</div>}>
        <RelatoriosContent />
      </Suspense>
    </div>
  )
}
