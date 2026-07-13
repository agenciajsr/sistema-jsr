'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Cliente = { id: string; nome: string }

export function SeletorCampanhas({
  clientes,
  clienteAtual,
  periodoAtual,
}: {
  clientes: Cliente[]
  clienteAtual: string | null
  periodoAtual: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Navega preservando o outro parâmetro lido FRESCO da URL. Antes, navegar()
  // usava os props (clienteAtual/periodoAtual), que refletem o último render do
  // servidor. Ao trocar o período logo após escolher o cliente, o prop
  // clienteAtual ainda vinha null e a URL era reconstruída SEM o cliente — o
  // SyncButton passava a avisar "selecione um cliente" e os dados sumiam.
  // Lendo da URL garantimos que mexer em UM seletor nunca apaga o valor do OUTRO.
  function navegar({ cliente, periodo }: { cliente?: string | null; periodo?: string }) {
    const clienteFinal = cliente !== undefined ? cliente : searchParams.get('cliente')
    const periodoFinal = periodo !== undefined ? periodo : searchParams.get('periodo') ?? periodoAtual

    const params = new URLSearchParams()
    if (clienteFinal) params.set('cliente', clienteFinal)
    params.set('periodo', periodoFinal)
    router.push(`/campanhas?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={clienteAtual ?? undefined}
        onValueChange={(id) => navegar({ cliente: id })}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Selecione um cliente" />
        </SelectTrigger>
        <SelectContent>
          {clientes.length === 0 ? (
            <SelectItem value="__none" disabled>
              Nenhum cliente com contas
            </SelectItem>
          ) : (
            clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Select
        value={periodoAtual}
        onValueChange={(p) => navegar({ periodo: p })}
      >
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
    </div>
  )
}
