import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getClientesLista } from '@/lib/clientes/lista'
import { ClientesLista } from './clientes-lista'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que o necessário. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

export default async function ClientesPage() {
  // Uma chamada, 6 queries agregadas sequenciais — o N+1 (1 query por cliente)
  // que existia aqui morreu junto com os cards grandes.
  const clientes = await getClientesLista()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-semibold">Clientes</h1>
        <Button asChild>
          <Link href="/clientes/novo">Cadastrar Cliente</Link>
        </Button>
      </div>

      <ClientesLista clientes={clientes} />
    </div>
  )
}
