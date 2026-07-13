import { Radar } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { acompanhamentoMock } from '@/lib/mock/extra'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

export default function AcompanhamentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de interações e observações por cliente.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo (ACOMP-01, adicionado ao escopo em
        2026-07-10). Ainda não é possível adicionar novas notas.
      </MockNotice>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2">
          <Radar className="size-4 text-primary" />
          <CardTitle className="text-base">Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {acompanhamentoMock.map((nota) => (
            <div key={nota.id} className="flex gap-3 rounded-lg border bg-background p-4">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {nota.autor.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{nota.cliente}</span>
                  <span className="text-xs text-muted-foreground">
                    · {nota.autor} · {nota.data}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{nota.nota}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
