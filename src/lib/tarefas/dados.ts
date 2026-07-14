import { eq, and, asc, sql, lt, lte, gte, inArray, isNotNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientes, profiles, tarefas, tarefaChecklistItems } from '@/lib/db/schema'
import { hojeBrasilia } from '@/lib/date-br'
import {
  janelaMaterializacao,
  ocorrenciasFaltantes,
  type TarefaStatus,
  type TarefaPrioridade,
  type TarefaRecorrencia,
} from '@/lib/tarefas/recorrencia'

// Módulo server comum — SEM 'use server': é chamado direto pelo Server Component
// da página, não pelo client. Evita expor um endpoint desnecessário.
//
// ⚠️ QUERIES SEQUENCIAIS, NUNCA PARALELAS (nada de paralelizar com Promise).
// O pool é max=3 com max_pipeline=0 (src/lib/db/index.ts): o Supavisor em
// transaction mode não suporta pipelining — queries paralelas na mesma conexão
// penduram PARA SEMPRE (nem o statement_timeout dispara). Isto foi a causa raiz
// dos travamentos corrigidos nos quicks 260713-usi e 260714-ita. Todas as
// queries aqui são AGREGADAS: o número delas NÃO cresce com o nº de tarefas.
//
// MATERIALIZAÇÃO PREGUIÇOSA (sem cron novo): os 2 slots de cron do plano Hobby
// da Vercel já estão ocupados (sync-meta + relatorios-semanais). Então abrir
// /tarefas é o ÚNICO caminho que materializa ocorrências — e é idempotente:
// a engine pura filtra o que já existe e o índice único (tarefa_mae_id, data)
// derruba qualquer duplicata que escape por corrida entre requests.

export type TarefaCard = {
  id: string
  titulo: string
  notas: string | null
  status: TarefaStatus
  prioridade: TarefaPrioridade
  data: string
  clienteId: string | null
  clienteNome: string | null
  responsavelId: string | null
  responsavelNome: string | null
  recorrencia: TarefaRecorrencia
  recorrenciaDias: number[] | null
  tarefaMaeId: string | null
  checklistTotal: number
  checklistConcluidos: number
}

export type TarefasDoDia = {
  dia: string
  hoje: string
  atrasadas: TarefaCard[]
  doDia: TarefaCard[]
  concluidas: TarefaCard[]
}

/** Linha crua vinda das SELECTs de tarefa (antes do merge do checklist). */
type TarefaRow = Omit<TarefaCard, 'checklistTotal' | 'checklistConcluidos'>

/** ORDER BY prioridade: urgente primeiro. Enum do PG ordena pela ordem de
 *  declaração ('baixa','media','alta','urgente') → DESC dá urgente→baixa. */
const ORDEM_PRIORIDADE = sql`${tarefas.prioridade} DESC`

const camposCard = {
  id: tarefas.id,
  titulo: tarefas.titulo,
  notas: tarefas.notas,
  status: tarefas.status,
  prioridade: tarefas.prioridade,
  data: tarefas.data,
  clienteId: tarefas.clienteId,
  clienteNome: clientes.nome,
  responsavelId: tarefas.responsavelId,
  responsavelNome: profiles.nome,
  recorrencia: tarefas.recorrencia,
  recorrenciaDias: tarefas.recorrenciaDias,
  tarefaMaeId: tarefas.tarefaMaeId,
}

function vazio(dia: string, hoje: string): TarefasDoDia {
  return { dia, hoje, atrasadas: [], doDia: [], concluidas: [] }
}

export async function getTarefasDoDia(diaSelecionado?: string): Promise<TarefasDoDia> {
  // "Hoje" SEMPRE via hojeBrasilia(): o relógio cru do server roda em UTC na
  // Vercel e viraria o dia a partir das 21h BR. Datas comparadas como string ISO.
  const hoje = hojeBrasilia()
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaSelecionado ?? '') ? diaSelecionado! : hoje

  try {
    // 1. Janela da materialização — puro, sem query.
    const { de, ate } = janelaMaterializacao(hoje, dia)

    // 2. Moldes ativos (a regra da série vive só aqui — D-04).
    const moldes = await db
      .select({
        id: tarefas.id,
        titulo: tarefas.titulo,
        notas: tarefas.notas,
        data: tarefas.data,
        prioridade: tarefas.prioridade,
        clienteId: tarefas.clienteId,
        responsavelId: tarefas.responsavelId,
        recorrencia: tarefas.recorrencia,
        recorrenciaDias: tarefas.recorrenciaDias,
      })
      .from(tarefas)
      .where(and(eq(tarefas.ehMolde, true), eq(tarefas.ativa, true)))

    if (moldes.length > 0) {
      const moldeIds = moldes.map((m) => m.id)

      // 3. O que JÁ existe na janela (base da idempotência).
      const existentes = await db
        .select({ tarefaMaeId: tarefas.tarefaMaeId, data: tarefas.data })
        .from(tarefas)
        .where(
          and(inArray(tarefas.tarefaMaeId, moldeIds), gte(tarefas.data, de), lte(tarefas.data, ate))
        )

      const porMolde = new Map<string, string[]>()
      for (const e of existentes) {
        if (!e.tarefaMaeId) continue
        const lista = porMolde.get(e.tarefaMaeId)
        if (lista) lista.push(e.data)
        else porMolde.set(e.tarefaMaeId, [e.data])
      }

      // 4. O que FALTA — puro, em memória.
      const aInserir = moldes.flatMap((molde) =>
        ocorrenciasFaltantes({
          molde: {
            data: molde.data,
            recorrencia: molde.recorrencia,
            recorrenciaDias: molde.recorrenciaDias as number[] | null,
          },
          existentes: porMolde.get(molde.id) ?? [],
          de,
          ate,
        }).map((dataOcorrencia) => ({
          titulo: molde.titulo,
          notas: molde.notas,
          prioridade: molde.prioridade,
          clienteId: molde.clienteId,
          responsavelId: molde.responsavelId,
          data: dataOcorrencia,
          // A ocorrência não carrega a regra: ela vive só no molde (D-04).
          recorrencia: 'nenhuma' as const,
          ehMolde: false,
          tarefaMaeId: molde.id,
          status: 'a_fazer' as const,
        }))
      )

      if (aInserir.length > 0) {
        // 5. INSERT em lote (UMA query). onConflictDoNothing sobre o índice
        //    único (tarefa_mae_id, data) é a trava de corrida: se dois requests
        //    abrirem /tarefas ao mesmo tempo, a duplicata é descartada e o
        //    returning devolve só o que REALMENTE nasceu.
        const nascidas = await db
          .insert(tarefas)
          .values(aInserir)
          .onConflictDoNothing()
          .returning({ id: tarefas.id, tarefaMaeId: tarefas.tarefaMaeId, data: tarefas.data })

        if (nascidas.length > 0) {
          // 6. Cada ocorrência precisa da SUA cópia dos itens do molde: a rotina
          //    "revisar contas" tem os mesmos passos todo dia, marcáveis por dia.
          const itensDosMoldes = await db
            .select({
              tarefaId: tarefaChecklistItems.tarefaId,
              texto: tarefaChecklistItems.texto,
              ordem: tarefaChecklistItems.ordem,
            })
            .from(tarefaChecklistItems)
            .where(inArray(tarefaChecklistItems.tarefaId, moldeIds))
            .orderBy(asc(tarefaChecklistItems.ordem))

          if (itensDosMoldes.length > 0) {
            const itensPorMolde = new Map<string, { texto: string; ordem: number }[]>()
            for (const it of itensDosMoldes) {
              const lista = itensPorMolde.get(it.tarefaId)
              if (lista) lista.push({ texto: it.texto, ordem: it.ordem })
              else itensPorMolde.set(it.tarefaId, [{ texto: it.texto, ordem: it.ordem }])
            }

            const copias = nascidas.flatMap((ocorrencia) =>
              (ocorrencia.tarefaMaeId ? (itensPorMolde.get(ocorrencia.tarefaMaeId) ?? []) : []).map(
                (item) => ({
                  tarefaId: ocorrencia.id,
                  texto: item.texto,
                  ordem: item.ordem,
                })
              )
            )

            if (copias.length > 0) {
              await db.insert(tarefaChecklistItems).values(copias)
            }
          }
        }
      }
    }

    // 7. Varredura (D-03): ocorrência aberta de dia passado vira `nao_realizada`.
    //    A próxima nasce pelo CALENDÁRIO, não pelo check.
    //    ⚠️ Só ocorrências (tarefa_mae_id IS NOT NULL): tarefas AVULSAS atrasadas
    //    continuam abertas de propósito — são elas que alimentam "Atrasadas".
    await db
      .update(tarefas)
      .set({ status: 'nao_realizada', updatedAt: new Date() })
      .where(
        and(
          isNotNull(tarefas.tarefaMaeId),
          lt(tarefas.data, hoje),
          inArray(tarefas.status, ['a_fazer', 'em_andamento'])
        )
      )

    // 8. As tarefas do dia selecionado (moldes nunca aparecem na lista).
    const doDiaRows = (await db
      .select(camposCard)
      .from(tarefas)
      .leftJoin(clientes, eq(tarefas.clienteId, clientes.id))
      .leftJoin(profiles, eq(tarefas.responsavelId, profiles.id))
      .where(and(eq(tarefas.ehMolde, false), eq(tarefas.data, dia)))
      .orderBy(ORDEM_PRIORIDADE, asc(tarefas.createdAt))) as TarefaRow[]

    // 9. Atrasadas — relativo ao HOJE real, não ao dia selecionado.
    const atrasadasRows = (await db
      .select(camposCard)
      .from(tarefas)
      .leftJoin(clientes, eq(tarefas.clienteId, clientes.id))
      .leftJoin(profiles, eq(tarefas.responsavelId, profiles.id))
      .where(
        and(
          eq(tarefas.ehMolde, false),
          lt(tarefas.data, hoje),
          inArray(tarefas.status, ['a_fazer', 'em_andamento'])
        )
      )
      .orderBy(ORDEM_PRIORIDADE, asc(tarefas.createdAt))) as TarefaRow[]

    // 10. Progresso do checklist AGREGADO — 1 query, nunca N+1.
    const todosOsIds = [...new Set([...doDiaRows, ...atrasadasRows].map((t) => t.id))]
    const progresso = new Map<string, { total: number; feitos: number }>()

    if (todosOsIds.length > 0) {
      const linhas = await db
        .select({
          tarefaId: tarefaChecklistItems.tarefaId,
          total: sql<number>`count(*)::int`,
          feitos: sql<number>`count(*) filter (where ${tarefaChecklistItems.concluido})::int`,
        })
        .from(tarefaChecklistItems)
        .where(inArray(tarefaChecklistItems.tarefaId, todosOsIds))
        .groupBy(tarefaChecklistItems.tarefaId)

      for (const l of linhas) progresso.set(l.tarefaId, { total: l.total, feitos: l.feitos })
    }

    const paraCard = (row: TarefaRow): TarefaCard => {
      const p = progresso.get(row.id)
      return {
        ...row,
        recorrenciaDias: (row.recorrenciaDias as number[] | null) ?? null,
        checklistTotal: p?.total ?? 0,
        checklistConcluidos: p?.feitos ?? 0,
      }
    }

    // Separação dos blocos em memória — sem query extra.
    return {
      dia,
      hoje,
      atrasadas: atrasadasRows.map(paraCard),
      doDia: doDiaRows
        .filter((t) => t.status === 'a_fazer' || t.status === 'em_andamento')
        .map(paraCard),
      // `nao_realizada` mora aqui junto das concluídas, com badge próprio na UI.
      concluidas: doDiaRows
        .filter((t) => t.status === 'concluida' || t.status === 'nao_realizada')
        .map(paraCard),
    }
  } catch (e) {
    // Nunca lança: a página degrada para o estado vazio em vez de quebrar.
    console.error('[getTarefasDoDia]', e)
    return vazio(dia, hoje)
  }
}
