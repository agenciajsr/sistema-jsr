// Tarefas vinculadas ao cliente para a ficha (quick-260717-i26).
// Módulo server comum (SEM 'use server' — a ficha é Server Component e chama
// direto, padrão de @/lib/cobrancas/dados). Duas queries SEQUENCIAIS agregadas
// e limitadas — sem N+1. Moldes (eh_molde=true) NUNCA aparecem em listas.

import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { profiles, tarefas } from '@/lib/db/schema'

export type TarefaFicha = {
  id: string
  codigo: string | null
  titulo: string
  subtitulo: string | null
  status: 'a_fazer' | 'em_andamento' | 'concluida' | 'nao_realizada'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  data: string
  concluidaEm: Date | null
  responsavelNome: string | null
}

export async function getTarefasDoClienteFicha(
  clienteId: string,
): Promise<{ abertas: TarefaFicha[]; historico: TarefaFicha[] }> {
  const colunas = {
    id: tarefas.id,
    codigo: tarefas.codigo,
    titulo: tarefas.titulo,
    subtitulo: tarefas.subtitulo,
    status: tarefas.status,
    prioridade: tarefas.prioridade,
    data: tarefas.data,
    concluidaEm: tarefas.concluidaEm,
    responsavelNome: profiles.nome,
  }

  // Query 1: abertas, mais urgentes (data mais próxima) primeiro.
  const abertas = await db
    .select(colunas)
    .from(tarefas)
    .leftJoin(profiles, eq(tarefas.responsavelId, profiles.id))
    .where(
      and(
        eq(tarefas.clienteId, clienteId),
        eq(tarefas.ehMolde, false),
        inArray(tarefas.status, ['a_fazer', 'em_andamento']),
      ),
    )
    .orderBy(asc(tarefas.data))
    .limit(50)

  // Query 2 (SEQUENCIAL): histórico — concluídas mais recentes primeiro,
  // fallback pela data de vencimento quando concluidaEm é nulo (legado).
  const historico = await db
    .select(colunas)
    .from(tarefas)
    .leftJoin(profiles, eq(tarefas.responsavelId, profiles.id))
    .where(
      and(
        eq(tarefas.clienteId, clienteId),
        eq(tarefas.ehMolde, false),
        inArray(tarefas.status, ['concluida', 'nao_realizada']),
      ),
    )
    .orderBy(sql`${tarefas.concluidaEm} desc nulls last`, sql`${tarefas.data} desc`)
    .limit(20)

  return {
    abertas: abertas as TarefaFicha[],
    historico: historico as TarefaFicha[],
  }
}
