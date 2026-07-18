import { asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getProfiles } from '@/actions/clientes'
import { hojeBrasilia } from '@/lib/date-br'
import { STATUS_ORDEM } from '@/lib/tarefas/quadro'
import type { TarefaStatus } from '@/lib/tarefas/recorrencia'
import { NovaTarefaForm } from './nova-tarefa-form'
import { BotaoVoltar } from '@/components/ui/botao-voltar'

// Backstop contra o timeout de 300s da Vercel — mesmo padrão de /tarefas/[id].
export const maxDuration = 60

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function NovaTarefaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; data?: string }>
}) {
  // Next 16: searchParams é uma Promise.
  const { status, data } = await searchParams

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  // ⚠️ SEQUENCIAL — nada de paralelizar com Promise: pool max=3 com
  // max_pipeline=0 (ver src/lib/db/index.ts).
  const clientesLista = await db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .orderBy(asc(clientes.nome))
  const responsaveis = await getProfiles()

  // O "+" da coluna manda ?status=; valor inválido na URL cai no padrão.
  const statusInicial: TarefaStatus = STATUS_ORDEM.includes(status as TarefaStatus)
    ? (status as TarefaStatus)
    : 'a_fazer'
  const dataInicial = DATA_ISO.test(data ?? '') ? data! : hojeBrasilia()

  return (
    <div className="space-y-4">
      <BotaoVoltar href="/tarefas" label="Tarefas" />
      <NovaTarefaForm
        clientes={clientesLista}
        responsaveis={responsaveis}
        statusInicial={statusInicial}
        dataInicial={dataInicial}
      />
    </div>
  )
}
