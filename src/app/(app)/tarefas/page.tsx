import { asc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { getProfiles } from '@/actions/clientes'
import { getTarefasDoPeriodo } from '@/lib/tarefas/dados'
import { TarefasQuadro } from './tarefas-quadro'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que o necessário. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>
}) {
  // Next 16: searchParams é uma Promise.
  const { de, ate } = await searchParams

  // ⚠️ SEQUENCIAL — nada de paralelizar com Promise: pool max=3 com
  // max_pipeline=0 (ver src/lib/db/index.ts).
  const dados = await getTarefasDoPeriodo(de, ate)
  const clientesLista = await db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .orderBy(asc(clientes.nome))
  const responsaveis = await getProfiles()

  return <TarefasQuadro dados={dados} clientes={clientesLista} responsaveis={responsaveis} />
}
