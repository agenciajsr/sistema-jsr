'use client'

// Botão "Voltar" reutilizável para telas de detalhe/drill-in do sistema.
// Dois modos:
//  - href: navega para uma rota-pai explícita (preferido — destino previsível).
//  - sem href: usa router.back() (histórico do navegador).
// Também aceita onClick para fechar overlays (ex.: fechar a ficha do lead).

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BotaoVoltarProps = {
  href?: string
  onClick?: () => void
  label?: string
  className?: string
}

export function BotaoVoltar({ href, onClick, label = 'Voltar', className }: BotaoVoltarProps) {
  const router = useRouter()
  const classes = cn('-ml-2 gap-1.5 text-muted-foreground hover:text-foreground', className)

  if (href) {
    return (
      <Button asChild variant="ghost" size="sm" className={classes}>
        <Link href={href}>
          <ArrowLeft className="size-4" />
          {label}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={classes}
      onClick={onClick ?? (() => router.back())}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Button>
  )
}
