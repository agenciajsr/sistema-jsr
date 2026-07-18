import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { ClienteForm } from '@/components/cliente-form'
import { BotaoVoltar } from '@/components/ui/botao-voltar'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

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
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-2">
        <BotaoVoltar href={`/clientes/${id}`} label="Cliente" />
        <h1 className="text-[28px] leading-tight font-semibold">Editar Cliente</h1>
      </div>
      <ClienteForm
        mode="editar"
        clienteId={cliente.id}
        defaultValues={{
          nome: cliente.nome,
          nicho: cliente.nicho,
          status: cliente.status,
          motivoEncerramento: cliente.motivoEncerramento ?? '',
          contatoNome: cliente.contatoNome ?? '',
          contatoTelefone: cliente.contatoTelefone ?? '',
          contatoEmail: cliente.contatoEmail ?? '',
          tipoPessoa: cliente.tipoPessoa ?? 'juridica',
          documento: cliente.documento ?? '',
          razaoSocial: cliente.razaoSocial ?? '',
          nomeFantasia: cliente.nomeFantasia ?? '',
          endereco: cliente.endereco ?? '',
          cidade: cliente.cidade ?? '',
          estado: cliente.estado ?? '',
          cep: cliente.cep ?? '',
          instagram: cliente.instagram ?? '',
          siteUrl: cliente.siteUrl ?? '',
          formaPagamento: cliente.formaPagamento ?? undefined,
          diaPagamento: cliente.diaPagamento ?? '',
          servicosContratados: ((cliente.servicosContratados ?? []) as typeof import('@/lib/validations/cliente').SERVICOS_DISPONIVEIS[number][]),
          gestorId: cliente.gestorId ?? '',
          verbaMensal: cliente.verbaMensal ? Number(cliente.verbaMensal) : '',
          ticketMedio: cliente.ticketMedio ? Number(cliente.ticketMedio) : '',
          agendamentoPosts: cliente.agendamentoPosts ?? false,
          frequenciaPosts: cliente.frequenciaPosts ?? '',
          notas: cliente.notas ?? '',
          origemCliente: cliente.origemCliente ?? '',
          objetivoPrincipal: cliente.objetivoPrincipal ?? '',
        }}
      />
    </div>
  )
}
