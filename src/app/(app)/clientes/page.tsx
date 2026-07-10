import Link from 'next/link'

import { getContratosDoCliente } from '@/actions/contratos'
import { ClienteCard } from '@/components/cliente-card'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'

export default async function ClientesPage() {
  const todosClientes = await db.query.clientes.findMany({
    orderBy: (clientes, { asc }) => [asc(clientes.nome)],
  })

  // ~10 clientes nesta fase (01-RESEARCH.md Open Question 2) — N+1 aceitável,
  // evita duplicar a lógica de seleção do contrato vigente fora de getContratosDoCliente.
  const clientesComContrato = await Promise.all(
    todosClientes.map(async (cliente) => {
      const { contratoAtual } = await getContratosDoCliente(cliente.id)
      return { cliente, contratoAtual }
    })
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-semibold">Clientes</h1>
        <Button asChild>
          <Link href="/clientes/novo">Cadastrar Cliente</Link>
        </Button>
      </div>

      {clientesComContrato.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-[20px] leading-tight font-semibold">
            Nenhum cliente cadastrado ainda
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Cadastre seu primeiro cliente para começar a acompanhar contratos e
            status.
          </p>
          <Button asChild>
            <Link href="/clientes/novo">Cadastrar Cliente</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {clientesComContrato.map(({ cliente, contratoAtual }) => (
            <ClienteCard key={cliente.id} cliente={cliente} contratoAtual={contratoAtual} />
          ))}
        </div>
      )}
    </div>
  )
}
