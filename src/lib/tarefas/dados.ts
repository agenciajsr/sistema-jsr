import { eq, and, asc, desc, sql, lt, lte, gte, inArray, isNotNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clientes,
  profiles,
  tarefas,
  tarefaChecklistItems,
  tarefaComentarios,
  tarefaAnexos,
  tarefaAtividades,
} from '@/lib/db/schema'
import { hojeBrasilia } from '@/lib/date-br'
import {
  janelaMaterializacao,
  ocorrenciasFaltantes,
  somaDias,
  JANELA_PASSADO_DIAS,
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
// da Vercel já estão ocupados (sync-meta + relatorios). Então abrir
// /tarefas é o ÚNICO caminho que materializa ocorrências — e é idempotente:
// a engine pura filtra o que já existe e o índice único (tarefa_mae_id, data)
// derruba qualquer duplicata que escape por corrida entre requests.
//
// D-05: o RECORTE é um INTERVALO (o quadro mostra 7 dias por padrão), e a lista
// volta CRUA — quem agrupa por status/estatísticas é o módulo puro ./quadro no
// client. Mesmo desenho de clientes/lista.ts + agregar.ts.

export type TarefaCard = {
  id: string
  titulo: string
  subtitulo: string | null
  notas: string | null
  descricao: string | null
  status: TarefaStatus
  prioridade: TarefaPrioridade
  data: string
  dataInicio: string | null
  tempoEstimado: string | null
  etiquetas: string[]
  codigo: string | null
  codigoNum: number | null
  clienteId: string | null
  clienteNome: string | null
  responsavelId: string | null
  responsavelNome: string | null
  recorrencia: TarefaRecorrencia
  recorrenciaDias: number[] | null
  tarefaMaeId: string | null
  fixada: boolean
  /** Timestamp ISO de conclusão (fuso UTC) — serializado na fronteira server→client. */
  concluidaEm: string | null
  checklistTotal: number
  checklistConcluidos: number
}

export type TarefasDoPeriodo = {
  inicio: string
  fim: string
  /** O DIA visualizado no quadro (= fim do intervalo). Visão diária (ibf). */
  dia: string
  hoje: string
  tarefas: TarefaCard[]
}

export type ItemChecklist = {
  id: string
  texto: string
  concluido: boolean
  ordem: number
  grupo: string
}

export type ComentarioTarefa = {
  id: string
  texto: string
  autorId: string | null
  autorNome: string
  createdAt: string
}

export type AnexoTarefa = {
  id: string
  nome: string
  tamanhoBytes: number
  mimeType: string
  storagePath: string
  uploadPorNome: string
  createdAt: string
}

export type AtividadeTarefa = {
  id: string
  tipo: string
  campo: string | null
  de: string | null
  para: string | null
  detalhe: string | null
  autorId: string | null
  autorNome: string
  createdAt: string
}

export type TarefaDetalhe = TarefaCard & {
  checklist: ItemChecklist[]
  comentarios: ComentarioTarefa[]
  anexos: AnexoTarefa[]
  atividades: AtividadeTarefa[]
}

/** Linha crua vinda das SELECTs de tarefa (antes do merge do checklist). */
type TarefaRow = Omit<
  TarefaCard,
  'checklistTotal' | 'checklistConcluidos' | 'etiquetas' | 'concluidaEm'
> & {
  etiquetas: unknown
  concluidaEm: Date | null
}

/** ORDER BY prioridade: urgente primeiro. Enum do PG ordena pela ordem de
 *  declaração ('baixa','media','alta','urgente') → DESC dá urgente→baixa. */
const ORDEM_PRIORIDADE = sql`${tarefas.prioridade} DESC`

const camposCard = {
  id: tarefas.id,
  titulo: tarefas.titulo,
  subtitulo: tarefas.subtitulo,
  notas: tarefas.notas,
  descricao: tarefas.descricao,
  status: tarefas.status,
  prioridade: tarefas.prioridade,
  data: tarefas.data,
  dataInicio: tarefas.dataInicio,
  tempoEstimado: tarefas.tempoEstimado,
  etiquetas: tarefas.etiquetas,
  codigo: tarefas.codigo,
  codigoNum: tarefas.codigoNum,
  clienteId: tarefas.clienteId,
  clienteNome: clientes.nome,
  responsavelId: tarefas.responsavelId,
  responsavelNome: profiles.nome,
  recorrencia: tarefas.recorrencia,
  recorrenciaDias: tarefas.recorrenciaDias,
  tarefaMaeId: tarefas.tarefaMaeId,
  fixada: tarefas.fixada,
  concluidaEm: tarefas.concluidaEm,
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Converte a linha crua no card, aplicando o progresso agregado. */
function paraCard(row: TarefaRow, progresso: Map<string, { total: number; feitos: number }>) {
  const p = progresso.get(row.id)
  return {
    ...row,
    // jsonb volta como unknown: normalizamos para array sempre.
    etiquetas: (row.etiquetas as string[] | null) ?? [],
    recorrenciaDias: (row.recorrenciaDias as number[] | null) ?? null,
    // Timestamp atravessa a fronteira server→client: serializa para ISO string.
    concluidaEm: row.concluidaEm?.toISOString() ?? null,
    checklistTotal: p?.total ?? 0,
    checklistConcluidos: p?.feitos ?? 0,
  }
}

/**
 * Visão DIÁRIA (ibf): o param é o DIA visualizado (?dia= na URL; inválido/
 * ausente → hoje). A busca continua cobrindo o INTERVALO [dia-30, dia] — é o
 * que alimenta as atrasadas em Pendentes/Em Andamento — mas o recorte do
 * quadro (tarefasDaVisaoDiaria, no client) é comandado pelo `dia` retornado.
 */
export async function getTarefasDoPeriodo(diaParam?: string): Promise<TarefasDoPeriodo> {
  // "Hoje" SEMPRE via hojeBrasilia(): o relógio cru do server roda em UTC na
  // Vercel e viraria o dia a partir das 21h BR. Datas comparadas como string ISO.
  const hoje = hojeBrasilia()
  const dia = DATA_ISO.test(diaParam ?? '') ? diaParam! : hoje
  const inicio = somaDias(dia, -JANELA_PASSADO_DIAS)
  const fim = dia

  try {
    // 1. Janela da materialização — puro, sem query. O FIM do intervalo visível
    //    é o "dia selecionado": o teto hoje+60 já mora na engine, então navegar
    //    para 2030 continua não explodindo linhas.
    const { de, ate } = janelaMaterializacao(hoje, fim)

    // 2. Moldes ativos (a regra da série vive só aqui — D-04 do quick anterior).
    const moldes = await db
      .select({
        id: tarefas.id,
        titulo: tarefas.titulo,
        notas: tarefas.notas,
        descricao: tarefas.descricao,
        data: tarefas.data,
        prioridade: tarefas.prioridade,
        tempoEstimado: tarefas.tempoEstimado,
        etiquetas: tarefas.etiquetas,
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
          descricao: molde.descricao,
          prioridade: molde.prioridade,
          tempoEstimado: molde.tempoEstimado,
          etiquetas: molde.etiquetas,
          clienteId: molde.clienteId,
          responsavelId: molde.responsavelId,
          data: dataOcorrencia,
          // A ocorrência não carrega a regra: ela vive só no molde.
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
              grupo: tarefaChecklistItems.grupo,
            })
            .from(tarefaChecklistItems)
            .where(inArray(tarefaChecklistItems.tarefaId, moldeIds))
            .orderBy(asc(tarefaChecklistItems.ordem))

          if (itensDosMoldes.length > 0) {
            const itensPorMolde = new Map<
              string,
              { texto: string; ordem: number; grupo: string }[]
            >()
            for (const it of itensDosMoldes) {
              const item = { texto: it.texto, ordem: it.ordem, grupo: it.grupo }
              const lista = itensPorMolde.get(it.tarefaId)
              if (lista) lista.push(item)
              else itensPorMolde.set(it.tarefaId, [item])
            }

            const copias = nascidas.flatMap((ocorrencia) =>
              (ocorrencia.tarefaMaeId ? (itensPorMolde.get(ocorrencia.tarefaMaeId) ?? []) : []).map(
                (item) => ({
                  tarefaId: ocorrencia.id,
                  texto: item.texto,
                  ordem: item.ordem,
                  // O agrupamento (D-08) precisa sobreviver à materialização.
                  grupo: item.grupo,
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

    // 7. Varredura: ocorrência aberta de dia passado vira `nao_realizada`.
    //    A próxima nasce pelo CALENDÁRIO, não pelo check.
    //    ⚠️ Só ocorrências (tarefa_mae_id IS NOT NULL): tarefas AVULSAS atrasadas
    //    continuam abertas de propósito — elas aparecem em Pendentes quando o
    //    intervalo as alcança.
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

    // 8. As tarefas do INTERVALO (moldes nunca aparecem no quadro).
    const linhas = (await db
      .select(camposCard)
      .from(tarefas)
      .leftJoin(clientes, eq(tarefas.clienteId, clientes.id))
      .leftJoin(profiles, eq(tarefas.responsavelId, profiles.id))
      .where(and(eq(tarefas.ehMolde, false), gte(tarefas.data, inicio), lte(tarefas.data, fim)))
      // D-08: fixada sobe ao topo da coluna; depois prioridade, depois criação.
      .orderBy(desc(tarefas.fixada), ORDEM_PRIORIDADE, asc(tarefas.createdAt))) as TarefaRow[]

    // 9. Progresso do checklist AGREGADO — 1 query, nunca N+1.
    const ids = linhas.map((t) => t.id)
    const progresso = new Map<string, { total: number; feitos: number }>()

    if (ids.length > 0) {
      const agregados = await db
        .select({
          tarefaId: tarefaChecklistItems.tarefaId,
          total: sql<number>`count(*)::int`,
          feitos: sql<number>`count(*) filter (where ${tarefaChecklistItems.concluido})::int`,
        })
        .from(tarefaChecklistItems)
        .where(inArray(tarefaChecklistItems.tarefaId, ids))
        .groupBy(tarefaChecklistItems.tarefaId)

      for (const a of agregados) progresso.set(a.tarefaId, { total: a.total, feitos: a.feitos })
    }

    // Lista CRUA (D-05): o client agrupa/filtra com o módulo puro ./quadro.
    return { inicio, fim, dia, hoje, tarefas: linhas.map((l) => paraCard(l, progresso)) }
  } catch (e) {
    // Nunca lança: a página degrada para o estado vazio em vez de quebrar.
    console.error('[getTarefasDoPeriodo]', e)
    return { inicio, fim, dia, hoje, tarefas: [] }
  }
}

/** A tarefa + seu checklist, para a página cheia /tarefas/[id]. */
export async function getTarefa(id: string): Promise<TarefaDetalhe | null> {
  try {
    // 2 queries SEQUENCIAIS (nada de paralelizar com Promise — ver o cabeçalho).
    const [linha] = (await db
      .select(camposCard)
      .from(tarefas)
      .leftJoin(clientes, eq(tarefas.clienteId, clientes.id))
      .leftJoin(profiles, eq(tarefas.responsavelId, profiles.id))
      .where(eq(tarefas.id, id))) as TarefaRow[]

    if (!linha) return null

    const checklist = await db
      .select({
        id: tarefaChecklistItems.id,
        texto: tarefaChecklistItems.texto,
        concluido: tarefaChecklistItems.concluido,
        ordem: tarefaChecklistItems.ordem,
        grupo: tarefaChecklistItems.grupo,
      })
      .from(tarefaChecklistItems)
      .where(eq(tarefaChecklistItems.tarefaId, id))
      .orderBy(asc(tarefaChecklistItems.grupo), asc(tarefaChecklistItems.ordem))

    const total = checklist.length
    const feitos = checklist.filter((i) => i.concluido).length
    const progresso = new Map([[id, { total, feitos }]])

    // D-10: cada leitura nova degrada sozinha. Se a 0017 ainda não foi aplicada,
    // a tabela não existe → devolvemos [] e o detalhe abre com a aba vazia, em
    // vez de derrubar a página inteira. Queries SEQUENCIAIS (nada de Promise).
    const comentarios = await lerComentarios(id)
    const anexos = await lerAnexos(id)
    const atividades = await lerAtividades(id)

    return { ...paraCard(linha, progresso), checklist, comentarios, anexos, atividades }
  } catch (e) {
    console.error('[getTarefa]', e)
    return null
  }
}

/** Comentários ASC por data. Try/catch próprio (D-10): tabela ausente → []. */
async function lerComentarios(tarefaId: string): Promise<ComentarioTarefa[]> {
  try {
    const linhas = await db
      .select({
        id: tarefaComentarios.id,
        texto: tarefaComentarios.texto,
        autorId: tarefaComentarios.autorId,
        autorNome: tarefaComentarios.autorNome,
        createdAt: tarefaComentarios.createdAt,
      })
      .from(tarefaComentarios)
      .where(eq(tarefaComentarios.tarefaId, tarefaId))
      .orderBy(asc(tarefaComentarios.createdAt))
    // createdAt atravessa a fronteira server→client: serializa para ISO string.
    return linhas.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))
  } catch (e) {
    console.error('[lerComentarios]', e)
    return []
  }
}

/** Anexos DESC por data. Try/catch próprio (D-10): tabela ausente → []. */
async function lerAnexos(tarefaId: string): Promise<AnexoTarefa[]> {
  try {
    const linhas = await db
      .select({
        id: tarefaAnexos.id,
        nome: tarefaAnexos.nome,
        tamanhoBytes: tarefaAnexos.tamanhoBytes,
        mimeType: tarefaAnexos.mimeType,
        storagePath: tarefaAnexos.storagePath,
        uploadPorNome: tarefaAnexos.uploadPorNome,
        createdAt: tarefaAnexos.createdAt,
      })
      .from(tarefaAnexos)
      .where(eq(tarefaAnexos.tarefaId, tarefaId))
      .orderBy(desc(tarefaAnexos.createdAt))
    return linhas.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))
  } catch (e) {
    console.error('[lerAnexos]', e)
    return []
  }
}

/** Atividades DESC por data, últimas 50. Try/catch próprio (D-10): ausente → []. */
async function lerAtividades(tarefaId: string): Promise<AtividadeTarefa[]> {
  try {
    const linhas = await db
      .select({
        id: tarefaAtividades.id,
        tipo: tarefaAtividades.tipo,
        campo: tarefaAtividades.campo,
        de: tarefaAtividades.de,
        para: tarefaAtividades.para,
        detalhe: tarefaAtividades.detalhe,
        autorId: tarefaAtividades.autorId,
        autorNome: tarefaAtividades.autorNome,
        createdAt: tarefaAtividades.createdAt,
      })
      .from(tarefaAtividades)
      .where(eq(tarefaAtividades.tarefaId, tarefaId))
      .orderBy(desc(tarefaAtividades.createdAt))
      .limit(50)
    return linhas.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))
  } catch (e) {
    console.error('[lerAtividades]', e)
    return []
  }
}
