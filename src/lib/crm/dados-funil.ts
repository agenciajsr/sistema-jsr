import { and, asc, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm'

import { db } from '@/lib/db'
import { crmEtapas, crmOportunidades, crmPipelines, crmTarefas } from '@/lib/db/schema'
import { getWorkspaceAtual } from '@/lib/crm/workspace'
import { ehEtapaReuniaoAgendada } from '@/lib/crm/reuniao'
import {
  calcularPeriodo,
  montarDashboard,
  PRESETS_PERIODO,
  type AgregadoPeriodo,
  type DashboardMontado,
  type PresetPeriodo,
} from '@/lib/crm/funil-comercial'

// Módulo server comum — SEM 'use server': chamado direto pelo Server Component
// da página /funil (mesmo padrão de dados.ts / decisão 260715-0zf).
//
// ⚠️ QUERIES SEQUENCIAIS E AGREGADAS (pool max=3 — NUNCA Promise.all): o número
// de queries NÃO cresce com o nº de oportunidades; tudo count/sum no banco.

export type PipelineResumo = { id: string; nome: string; padrao: boolean }

export type DashboardComercial = DashboardMontado & {
  configurado: boolean
  pipelineId: string | null
  pipelineNome: string | null
  pipelines: PipelineResumo[]
  periodo: PresetPeriodo
}

const DASHBOARD_VAZIO: Omit<DashboardComercial, 'periodo'> = {
  configurado: false,
  pipelineId: null,
  pipelineNome: null,
  pipelines: [],
  kpis: {
    novosLeads: { valor: 0, variacao: null },
    agendados: { valor: 0, variacao: null },
    vendas: { valor: 0, variacao: null },
    receitaTotal: { valor: 0, variacao: null },
    leadsPerdidos: { valor: 0, variacao: null },
  },
  funil: { novoLead: 0, agendado: 0, pagou: 0, taxaNovoAgendado: 0, taxaAgendadoPagou: 0 },
  performance: {
    conversaoTotal: { valor: 0, variacao: null },
    ticketMedio: { valor: 0, variacao: null },
    receitaPorLead: { valor: 0, variacao: null },
  },
  origens: [],
}

// Hoje no calendário de Brasília (en-CA formata YYYY-MM-DD).
function hojeBrasiliaISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

// Intervalo [início 00:00, fim 23:59:59.999] no fuso de Brasília (UTC-3 fixo,
// Brasil não tem horário de verão desde 2019).
function limites(inicioISO: string, fimISO: string): { de: Date; ate: Date } {
  return {
    de: new Date(`${inicioISO}T00:00:00.000-03:00`),
    ate: new Date(`${fimISO}T23:59:59.999-03:00`),
  }
}

export function presetValido(periodo: string | undefined): PresetPeriodo {
  return PRESETS_PERIODO.includes(periodo as PresetPeriodo)
    ? (periodo as PresetPeriodo)
    : 'este-mes'
}

/**
 * Única fonte de dados da página /funil: KPIs, funil, performance e origens do
 * período — tudo agregado no banco, com o período anterior para as variações.
 */
export async function getDashboardComercial(
  pipelineIdParam?: string,
  preset?: PresetPeriodo
): Promise<DashboardComercial> {
  const periodo = preset ?? 'este-mes'
  try {
    // (1) workspace único do v1 (null = migration não aplicada → degrada)
    const workspace = await getWorkspaceAtual()
    if (!workspace) return { ...DASHBOARD_VAZIO, periodo }

    // (2) pipelines do workspace (seletor) + o ativo (?pipeline= → padrão → 1º)
    const pipelines = await db
      .select({ id: crmPipelines.id, nome: crmPipelines.nome, padrao: crmPipelines.padrao })
      .from(crmPipelines)
      .where(eq(crmPipelines.workspaceId, workspace.id))
      .orderBy(asc(crmPipelines.ordem), asc(crmPipelines.createdAt))

    const pipeline =
      pipelines.find((p) => p.id === pipelineIdParam) ??
      pipelines.find((p) => p.padrao) ??
      pipelines[0]
    if (!pipeline) return { ...DASHBOARD_VAZIO, periodo }

    // (3) etapas — para achar a etapa "Reunião agendada" e as de ordem >= dela
    const etapas = await db
      .select({ id: crmEtapas.id, nome: crmEtapas.nome, ordem: crmEtapas.ordem })
      .from(crmEtapas)
      .where(eq(crmEtapas.pipelineId, pipeline.id))
      .orderBy(asc(crmEtapas.ordem))

    const etapaReuniao = etapas.find((e) => ehEtapaReuniaoAgendada(e.nome))
    const etapasAposReuniao = etapaReuniao
      ? etapas.filter((e) => e.ordem >= etapaReuniao.ordem).map((e) => e.id)
      : []

    const intervalos = calcularPeriodo(periodo, hojeBrasiliaISO())

    // (4) agregados por período — mesma sequência de queries para atual e anterior
    async function agregadosDoPeriodo(inicioISO: string, fimISO: string): Promise<AgregadoPeriodo> {
      const { de, ate } = limites(inicioISO, fimISO)

      // criadas no período
      const [criadasRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmOportunidades)
        .where(
          and(
            eq(crmOportunidades.pipelineId, pipeline!.id),
            gte(crmOportunidades.createdAt, de),
            lte(crmOportunidades.createdAt, ate)
          )
        )

      // ganhas no período (por ganhaEm) + receita
      const [ganhasRow] = await db
        .select({
          total: sql<number>`count(*)::int`,
          receita: sql<string>`coalesce(sum(${crmOportunidades.valor}), 0)`,
        })
        .from(crmOportunidades)
        .where(
          and(
            eq(crmOportunidades.pipelineId, pipeline!.id),
            eq(crmOportunidades.status, 'ganha'),
            gte(crmOportunidades.ganhaEm, de),
            lte(crmOportunidades.ganhaEm, ate)
          )
        )

      // perdidas no período (por perdidaEm)
      const [perdidasRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmOportunidades)
        .where(
          and(
            eq(crmOportunidades.pipelineId, pipeline!.id),
            eq(crmOportunidades.status, 'perdida'),
            gte(crmOportunidades.perdidaEm, de),
            lte(crmOportunidades.perdidaEm, ate)
          )
        )

      // AGENDADO — heurística mais honesta com os dados existentes: oportunidade
      // CRIADA no período que (a) tem tarefa de reunião vinculada (o ReuniaoDialog
      // cria essa tarefa ao mover para Reunião agendada), OU (b) está numa etapa
      // de ordem >= "Reunião agendada", OU (c) já foi ganha. Sem etapa de reunião
      // no pipeline, valem só (a) e (c). Uma query, count no banco.
      const condicoesAgendado: SQL[] = [
        sql`exists (select 1 from ${crmTarefas} t where t.oportunidade_id = ${crmOportunidades.id} and t.tipo = 'reuniao')`,
        eq(crmOportunidades.status, 'ganha'),
      ]
      if (etapasAposReuniao.length > 0) {
        condicoesAgendado.push(inArray(crmOportunidades.etapaId, etapasAposReuniao) as SQL)
      }
      const [agendadasRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmOportunidades)
        .where(
          and(
            eq(crmOportunidades.pipelineId, pipeline!.id),
            gte(crmOportunidades.createdAt, de),
            lte(crmOportunidades.createdAt, ate),
            or(...condicoesAgendado)
          )
        )

      return {
        criadas: criadasRow?.total ?? 0,
        agendadas: agendadasRow?.total ?? 0,
        ganhas: ganhasRow?.total ?? 0,
        receita: Number(ganhasRow?.receita ?? 0),
        perdidas: perdidasRow?.total ?? 0,
      }
    }

    const atual = await agregadosDoPeriodo(intervalos.inicio, intervalos.fim)
    const anterior = await agregadosDoPeriodo(intervalos.inicioAnterior, intervalos.fimAnterior)

    // (5) origens das criadas no período atual — GROUP BY no banco
    const { de, ate } = limites(intervalos.inicio, intervalos.fim)
    const origens = await db
      .select({ origem: crmOportunidades.origem, total: sql<number>`count(*)::int` })
      .from(crmOportunidades)
      .where(
        and(
          eq(crmOportunidades.pipelineId, pipeline.id),
          gte(crmOportunidades.createdAt, de),
          lte(crmOportunidades.createdAt, ate)
        )
      )
      .groupBy(crmOportunidades.origem)
      .orderBy(sql`count(*) desc`)

    return {
      ...montarDashboard({ atual, anterior, origens }),
      configurado: true,
      pipelineId: pipeline.id,
      pipelineNome: pipeline.nome,
      pipelines,
      periodo,
    }
  } catch (e) {
    // Tabelas ainda não existem ou soluço de conexão: degrada graciosamente.
    console.error('[getDashboardComercial]', e)
    return { ...DASHBOARD_VAZIO, periodo }
  }
}
