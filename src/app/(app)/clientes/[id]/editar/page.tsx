import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { ClienteForm } from '@/components/cliente-form'
import { BotaoVoltar } from '@/components/ui/botao-voltar'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [cliente, usuario] = await Promise.all([
    db.query.clientes.findFirst({ where: eq(clientes.id, id) }),
    getCurrentUser(),
  ])
  if (!cliente) {
    notFound()
  }
  const isAdmin = usuario?.role === 'admin'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-2">
        <BotaoVoltar href={`/clientes/${id}`} label="Cliente" />
        <h1 className="text-[28px] leading-tight font-semibold">Editar Cliente</h1>
      </div>
      <ClienteForm
        mode="editar"
        clienteId={cliente.id}
        isAdmin={isAdmin}
        defaultValues={{
          nome: cliente.nome,
          nicho: cliente.nicho,
          segmento: cliente.segmento ?? '',
          principalServico: cliente.principalServico ?? '',
          tagsTexto: (Array.isArray(cliente.tags) ? (cliente.tags as string[]) : []).join(', '),
          status: cliente.status,
          // Preserva o perfil interno ao editar — sem isto o campo cairia no
          // default (false) do Zod e salvar desmarcaria o perfil mãe.
          interno: cliente.interno,
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
          linkDrive: cliente.linkDrive ?? '',
          pastas: ((cliente.pastas ?? []) as { nome: string; url: string }[]),
        }}
      />
    </div>
  )
}
