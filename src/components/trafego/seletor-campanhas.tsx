'use client'

import { useRouter } from 'next/navigation'

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

  function navegar(cliente: string | null, periodo: string) {
    const params = new URLSearchParams()
    if (cliente) params.set('cliente', cliente)
    params.set('periodo', periodo)
    router.push(`/campanhas?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={clienteAtual ?? undefined}
        onValueChange={(id) => navegar(id, periodoAtual)}
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
        onValueChange={(p) => navegar(clienteAtual, p)}
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
