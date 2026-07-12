import Image from 'next/image'
import { ImageOff, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CriativoRanking } from '@/lib/trafego/aggregate'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')

type Props = {
  topCriativos: CriativoRanking[]
  labelHeroi: string
}

export function CriativosCampeoes({ topCriativos, labelHeroi }: Props) {
  if (topCriativos.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Criativos campeões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Sincronize para ver os criativos que mais performam.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">Criativos campeões</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topCriativos.map((c) => (
            <div
              key={c.adId}
              className="flex gap-3 rounded-lg border border-border/50 p-3 transition-all hover:shadow-[var(--shadow-sm)]"
            >
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {c.thumbUrl ? (
                  <Image
                    src={c.thumbUrl}
                    alt={c.adName}
                    width={64}
                    height={64}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageOff className="size-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <p className="truncate text-sm font-medium">{c.adName}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.adsetName}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-medium text-foreground">
                    {formatadorNumero.format(c.resultadoPrimario)} {labelHeroi.toLowerCase()}
                  </span>
                  <span className="text-muted-foreground">
                    {formatadorMoeda.format(c.spend)}
                  </span>
                  {c.cpaOuCpl !== null && (
                    <span className="text-muted-foreground">
                      CPA {formatadorMoeda.format(c.cpaOuCpl)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
