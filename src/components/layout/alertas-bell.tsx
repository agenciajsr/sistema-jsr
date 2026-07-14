'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

import { getContagemAlertasNovos } from '@/actions/alertas'

// Sino de alertas do cabeçalho. Client component: busca a contagem DEPOIS que a
// página já renderizou (via server action), para NÃO bloquear a renderização de
// nenhuma página. Conta apenas os alertas com status 'novo' — count(*) barato
// na tabela alertas (index em status).
export function AlertasBell() {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    getContagemAlertasNovos()
      .then((novos) => setTotal(novos))
      .catch(() => setTotal(0))
  }, [])

  return (
    <Link
      href="/alertas"
      aria-label={`Alertas${total > 0 ? ` (${total})` : ''}`}
      className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Bell className="size-5" />
      {total > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground">
          {total}
        </span>
      )}
    </Link>
  )
}
