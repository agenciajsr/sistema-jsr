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
  periodoAtual: '7' | '30'
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
          <SelectItem value="7">Últimos 7 dias</SelectItem>
          <SelectItem value="30">Últimos 30 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
