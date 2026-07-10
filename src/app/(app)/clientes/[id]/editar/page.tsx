import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { ClienteForm } from '@/components/cliente-form'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, id),
  })
  if (!cliente) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <h1 className="text-[28px] leading-tight font-semibold">Editar Cliente</h1>
      <ClienteForm
        mode="editar"
        clienteId={cliente.id}
        defaultValues={{
          nome: cliente.nome,
          nicho: cliente.nicho,
          status: cliente.status,
          contatoNome: cliente.contatoNome ?? '',
          contatoTelefone: cliente.contatoTelefone ?? '',
          contatoEmail: cliente.contatoEmail ?? '',
          notas: cliente.notas ?? '',
        }}
      />
    </div>
  )
}
