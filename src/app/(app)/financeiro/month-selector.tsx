'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

const MESES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function MonthSelector({ mes, ano }: { mes: number; ano: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigateTo(novoMes: number, novoAno: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', String(novoMes))
    params.set('ano', String(novoAno))
    router.push(`/financeiro?${params.toString()}`)
  }

  function prevMonth() {
    if (mes === 1) {
      navigateTo(12, ano - 1)
    } else {
      navigateTo(mes - 1, ano)
    }
  }

  function nextMonth() {
    if (mes === 12) {
      navigateTo(1, ano + 1)
    } else {
      navigateTo(mes + 1, ano)
    }
  }

  function goToCurrentMonth() {
    const agora = new Date()
    navigateTo(agora.getMonth() + 1, agora.getFullYear())
  }

  const agora = new Date()
  const isMesAtual = mes === agora.getMonth() + 1 && ano === agora.getFullYear()

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={prevMonth} className="size-8">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[160px] text-center text-sm font-medium">
        {MESES[mes - 1]} {ano}
      </span>
      <Button variant="outline" size="icon" onClick={nextMonth} className="size-8">
        <ChevronRight className="size-4" />
      </Button>
      {!isMesAtual && (
        <Button variant="ghost" size="sm" onClick={goToCurrentMonth} className="text-xs">
          Mes atual
        </Button>
      )}
    </div>
  )
}
