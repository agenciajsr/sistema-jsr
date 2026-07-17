'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Seletor de PERÍODO de /campanhas. O cliente é escolhido pelos cards da
// LandingClientes — o antigo Select de cliente daqui era redundante e foi
// removido (quick 260717-dlk).
export function SeletorCampanhas({ periodoAtual }: { periodoAtual: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Preserva o cliente lendo FRESCO da URL: trocar o período nunca apaga o
  // cliente selecionado (mesma lógica defensiva de antes).
  function trocarPeriodo(periodo: string) {
    const params = new URLSearchParams()
    const cliente = searchParams.get('cliente')
    if (cliente) params.set('cliente', cliente)
    params.set('periodo', periodo)
    router.push(`/campanhas?${params.toString()}`)
  }

  return (
    <Select value={periodoAtual} onValueChange={trocarPeriodo}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="hoje">Hoje</SelectItem>
        <SelectItem value="ontem">Ontem</SelectItem>
        <SelectItem value="7d">7 dias</SelectItem>
        <SelectItem value="30d">30 dias</SelectItem>
      </SelectContent>
    </Select>
  )
}
