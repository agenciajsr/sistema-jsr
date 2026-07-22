'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type PlataformaAba = 'meta' | 'google' | 'compilado'

const LABEL_PLATAFORMA: Record<PlataformaAba, string> = {
  meta: 'Meta',
  google: 'Google',
  compilado: 'Compilado',
}

// Seletor de ABAS de plataforma do painel de /campanhas. Espelha o padrão do
// SeletorCampanhas (server-render por searchParam): troca só o ?plataforma=,
// preservando cliente E periodo lidos FRESCOS da URL — trocar de aba nunca
// perde o cliente selecionado nem o período.
export function SeletorPlataforma({ plataformaAtual }: { plataformaAtual: PlataformaAba }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function trocarPlataforma(p: string) {
    const params = new URLSearchParams()
    const cliente = searchParams.get('cliente')
    const periodo = searchParams.get('periodo')
    if (cliente) params.set('cliente', cliente)
    if (periodo) params.set('periodo', periodo)
    params.set('plataforma', p)
    router.push(`/campanhas?${params.toString()}`)
  }

  return (
    <Tabs value={plataformaAtual} onValueChange={trocarPlataforma}>
      <TabsList>
        <TabsTrigger value="meta">Meta</TabsTrigger>
        <TabsTrigger value="google">Google</TabsTrigger>
        <TabsTrigger value="compilado">Compilado</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

// Tons discretos por plataforma do BADGE: Meta azul (primary), Google âmbar,
// Compilado neutro/muted.
const CLASSE_BADGE: Record<PlataformaAba, string> = {
  meta: 'bg-primary/10 text-primary ring-primary/15',
  google: 'bg-chart-warning/10 text-chart-warning ring-chart-warning/20',
  compilado: 'bg-muted text-muted-foreground ring-muted-foreground/20',
}

// Selinho discreto indicando qual plataforma está sendo vista no painel.
export function BadgePlataforma({ plataforma }: { plataforma: PlataformaAba }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        CLASSE_BADGE[plataforma],
      )}
    >
      {LABEL_PLATAFORMA[plataforma]}
    </span>
  )
}
