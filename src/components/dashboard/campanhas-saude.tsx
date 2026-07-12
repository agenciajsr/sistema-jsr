import Link from 'next/link'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import type { ClientePerformance } from '@/lib/dashboard/data'
import type { NivelSaude } from '@/lib/mock/dashboard-ref'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function calcularSaude(c: ClientePerformance): { nivel: NivelSaude; rotulo: string; score: number } {
  let score = 50

  // Se o cliente tem meta de ROAS definida, usar como referência
  if (c.roas !== null && c.metaRoas !== null) {
    const ratio = c.roas / c.metaRoas
    if (ratio >= 1.2) score = 95
    else if (ratio >= 1) score = 80
    else if (ratio >= 0.7) score = 55
    else score = 25
  } else if (c.cpa !== null && c.metaCpa !== null) {
    // Meta de CPA: quanto menor melhor
    const ratio = c.metaCpa / c.cpa // invertido: CPA abaixo da meta = bom
    if (ratio >= 1.3) score = 95
    else if (ratio >= 1) score = 80
    else if (ratio >= 0.7) score = 50
    else score = 25
  } else if (c.roas !== null) {
    // Fallback sem meta — usar baseline genérico
    if (c.roas >= 4) score = 95
    else if (c.roas >= 2.5) score = 75
    else if (c.roas >= 1) score = 50
    else score = 25
  } else if (c.resultadoHeroi > 0 && c.cpa !== null) {
    if (c.cpa < 50) score = 90
    else if (c.cpa < 100) score = 70
    else if (c.cpa < 200) score = 45
    else score = 20
  }

  const nivel: NivelSaude = score >= 80 ? 'excelente' : score >= 60 ? 'boa' : score >= 40 ? 'atencao' : 'critica'
  const rotulo = nivel === 'excelente' ? 'Excelente' : nivel === 'boa' ? 'Boa' : nivel === 'atencao' ? 'Atenção' : 'Crítica'

  return { nivel, rotulo, score }
}

type Props = {
  clientes: ClientePerformance[]
}

export function CampanhasSaude({ clientes }: Props) {
  if (clientes.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Saúde das Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem dados de campanhas para avaliar.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Saúde das Campanhas</CardTitle>
        <Link href="/campanhas" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {clientes.slice(0, 4).map((c) => {
          const { nivel, rotulo, score } = calcularSaude(c)
          return (
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
                  {c.resultadoHeroi} {c.labelHeroi.toLowerCase()}
                </p>
              </div>
              <StatusBadge nivel={nivel} rotulo={rotulo} score={score} />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
