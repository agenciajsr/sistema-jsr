'use client'

// Filtro de período do feed de acompanhamento: presets (hoje/ontem/7d/30d) +
// data personalizada. Comanda a URL (?periodo= / ?dia=) — o server refaz a query.

import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

const PRESETS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
] as const

export function FiltroFeed() {
  const router = useRouter()
  const sp = useSearchParams()
  const dia = sp.get('dia')
  const periodoAtivo = dia ? null : (sp.get('periodo') ?? '7d')

  function irPreset(periodo: string) {
    router.push(`/acompanhamento?periodo=${periodo}`)
  }

  function irDia(valor: string) {
    if (valor) router.push(`/acompanhamento?dia=${valor}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.valor}
          variant={periodoAtivo === p.valor ? 'default' : 'outline'}
          size="sm"
          onClick={() => irPreset(p.valor)}
        >
          {p.rotulo}
        </Button>
      ))}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Data específica:
        <input
          type="date"
          value={dia ?? ''}
          onChange={(e) => irDia(e.target.value)}
          className={`h-8 rounded-md border px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 ${dia ? 'border-primary bg-primary/5 text-foreground' : 'border-border bg-background'}`}
        />
      </label>
    </div>
  )
}
