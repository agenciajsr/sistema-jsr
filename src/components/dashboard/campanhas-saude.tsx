import Link from 'next/link'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { campanhasSaudeMock } from '@/lib/mock/dashboard-ref'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

// Lista de saúde das campanhas por cliente. Server component.
export function CampanhasSaude() {
  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Saúde das Campanhas</CardTitle>
        <Link href="/campanhas" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {campanhasSaudeMock.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {iniciais(c.nome)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.nome}</p>
              <p className="text-xs text-muted-foreground">
                {c.campanhasAtivas} campanhas ativas
              </p>
            </div>
            <StatusBadge nivel={c.nivel} rotulo={c.rotulo} score={c.score} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
