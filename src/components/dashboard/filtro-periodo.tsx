'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function gerarOpcoes() {
  const opcoes: { value: string; label: string }[] = []
  const agora = new Date()
  const nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  for (let i = 0; i < 12; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    const mes = d.getMonth() + 1
    const ano = d.getFullYear()
    opcoes.push({
      value: `${ano}-${String(mes).padStart(2, '0')}`,
      label: `${nomesMes[mes - 1]} ${ano}`,
    })
  }
  return opcoes
}

export function FiltroPeriodo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const opcoes = gerarOpcoes()

  const atual = searchParams.get('periodo') ?? opcoes[0].value

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === opcoes[0].value) {
      params.delete('periodo')
    } else {
      params.set('periodo', value)
    }
    const qs = params.toString()
    router.push(qs ? `/painel?${qs}` : '/painel')
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="size-4 text-muted-foreground" />
      <Select value={atual} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[160px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
