import { asc } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'

import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getProfiles } from '@/actions/clientes'
import { getTarefa } from '@/lib/tarefas/dados'
import { TarefaDetalhe } from './tarefa-detalhe'

// Backstop contra o timeout de 300s da Vercel — mesmo padrão de /tarefas.
export const maxDuration = 60

export default async function TarefaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Next 16: params é uma Promise.
  const { id } = await params

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  // ⚠️ SEQUENCIAL — nada de paralelizar com Promise: pool max=3 com
  // max_pipeline=0 (ver src/lib/db/index.ts).
  const tarefa = await getTarefa(id)
  if (!tarefa) notFound()

  const clientesLista = await db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .orderBy(asc(clientes.nome))
  const responsaveis = await getProfiles()

  // Um único caminho de voltar: o botão + breadcrumb dentro do TarefaDetalhe.
  return (
    <TarefaDetalhe
      tarefa={tarefa}
      clientes={clientesLista}
      responsaveis={responsaveis}
      usuarioId={currentUser.id}
    />
  )
}
