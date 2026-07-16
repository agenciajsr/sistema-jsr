'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Client component mínimo só para o window.print (o preview é Server Component).
export function BotaoImprimir() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" />
      Imprimir / salvar PDF
    </Button>
  )
}
