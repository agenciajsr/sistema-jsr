import { and, asc, eq, lt, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  crmEmpresas,
  crmContatos,
  crmEtapas,
  crmPipelines,
  crmOportunidades,
  crmTarefas,
} from '@/lib/db/schema'
import { getWorkspaceAtual } from '@/lib/crm/workspace'

// Módulo server comum — SEM 'use server': é chamado direto pelo Server Component
// da página /crm, não pelo client. Evita expor um endpoint desnecessário.
//
// ⚠️ QUERIES SEQUENCIAIS E AGREGADAS (nada de paralelizar com Promise, nada de
// N+1 por coluna/card): pool max=3 com max_pipeline=0 — ver src/lib/db/index.ts.
// O número de queries NÃO cresce com o nº de oportunidades. Os KPIs vêm de
// GROUP BY/count no banco — nunca iterando todas as linhas em memória para contá-las.

export type OportunidadeCard = {
  id: string
  titulo: string
  valor: number | null
  tipoReceita: string | null
  etapaId: string
  ordemNaEtapa: number
  origem: string | null
  contatoNome: string | null
  empresaNome: string | null
  dataPrevistaFechamento: string | null
  // Adicionados para o mockup: tempo relativo e aviso "Nao contatado".
  createdAt: string // ISO
  semContato: boolean
}

export type EtapaKanban = {
  id: string
  nome: string
  ordem: number
  cor: string | null
  probabilidade: number | null
}

export type ColunaKanban = {
  etapa: EtapaKanban
  oportunidades: OportunidadeCard[]
  total: number
  somaValor: number
}

export type Kanban = {
  // false = workspace/pipeline não existem (migration 0019 ainda não aplicada):
  // a página degrada graciosamente com aviso em vez de quebrar.
  configurado: boolean
  pipelineNome: string | null
  etapas: EtapaKanban[]
  colunas: ColunaKanban[]
}

// KPIs da faixa superior do CRM (todos derivados de aggregates no banco).
export type KpisCrm = {
  totalOportunidades: number // oportunidades ABERTAS
  valorOrigem: number // soma do valor das abertas
  taxaConversao: number // ganhas / (ganhas + perdidas) em %
  ganhas: number
  atividadesAtrasadas: number
  semContato: number // abertas +7d sem tarefa concluída
}

export type OrigemDistrib = { origem: string; total: number; pct: number }

export type CrmVisaoGeral = Kanban & { kpis: KpisCrm; origens: OrigemDistrib[] }

const KPIS_ZERO: KpisCrm = {
  totalOportunidades: 0,
  valorOrigem: 0,
  taxaConversao: 0,
  ganhas: 0,
  atividadesAtrasadas: 0,
  semContato: 0,
}

const VISAO_VAZIA: CrmVisaoGeral = {
  configurado: false,
  pipelineNome: null,
  etapas: [],
  colunas: [],
  kpis: KPIS_ZERO,
  origens: [],
}

// Janela da heurística "sem contato": aberta há mais de 7 dias.
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

// getCrmVisaoGeral é a ÚNICA fonte de dados da página /crm (substitui a antiga
// getKanban): entrega o kanban + os 6 KPIs + a distribuição de origem, tudo com
// queries sequenciais/agregadas. Degrada para VISAO_VAZIA sem quebrar.
export async function getCrmVisaoGeral(): Promise<CrmVisaoGeral> {
  try {
    // (1) workspace único do v1 (null = 0019 não aplicada)
    const workspace = await getWorkspaceAtual()
    if (!workspace) return VISAO_VAZIA

    // (2) pipeline padrão
    const [pipeline] = await db
      .select({ id: crmPipelines.id, nome: crmPipelines.nome })
      .from(crmPipelines)
      .where(and(eq(crmPipelines.workspaceId, workspace.id), eq(crmPipelines.padrao, true)))
      .limit(1)

    if (!pipeline) return VISAO_VAZIA

    // (3) etapas do pipeline
    const etapas = await db
      .select({
        id: crmEtapas.id,
        nome: crmEtapas.nome,
        ordem: crmEtapas.ordem,
        cor: crmEtapas.cor,
        probabilidade: crmEtapas.probabilidade,
      })
      .from(crmEtapas)
      .where(eq(crmEtapas.pipelineId, pipeline.id))
      .orderBy(asc(crmEtapas.ordem))

    // (4) TODAS as oportunidades ABERTAS do pipeline em UMA query, com os nomes
    // de contato/empresa via leftJoin (nada de N+1 por coluna). Traz createdAt.
    const abertas = await db
      .select({
        id: crmOportunidades.id,
        titulo: crmOportunidades.titulo,
        valor: crmOportunidades.valor,
        tipoReceita: crmOportunidades.tipoReceita,
        etapaId: crmOportunidades.etapaId,
        ordemNaEtapa: crmOportunidades.ordemNaEtapa,
        origem: crmOportunidades.origem,
        dataPrevistaFechamento: crmOportunidades.dataPrevistaFechamento,
        createdAt: crmOportunidades.createdAt,
        contatoNome: crmContatos.nome,
        empresaNome: crmEmpresas.nome,
      })
      .from(crmOportunidades)
      .leftJoin(crmContatos, eq(crmOportunidades.contatoId, crmContatos.id))
      .leftJoin(crmEmpresas, eq(crmOportunidades.empresaId, crmEmpresas.id))
      .where(
        and(eq(crmOportunidades.pipelineId, pipeline.id), eq(crmOportunidades.status, 'aberta'))
      )
      .orderBy(asc(crmOportunidades.etapaId), asc(crmOportunidades.ordemNaEtapa))

    // (5) KPI por status — GROUP BY no banco (não itera linhas em memória).
    const porStatus = await db
      .select({
        status: crmOportunidades.status,
        total: sql<number>`count(*)::int`,
        valor: sql<string>`coalesce(sum(${crmOportunidades.valor}), 0)`,
      })
      .from(crmOportunidades)
      .where(eq(crmOportunidades.pipelineId, pipeline.id))
      .groupBy(crmOportunidades.status)

    let totalOportunidades = 0
    let valorOrigem = 0
    let ganhas = 0
    let perdidas = 0
    for (const linha of porStatus) {
      if (linha.status === 'aberta') {
        totalOportunidades = linha.total
        valorOrigem = Number(linha.valor)
      } else if (linha.status === 'ganha') {
        ganhas = linha.total
      } else if (linha.status === 'perdida') {
        perdidas = linha.total
      }
    }
    const fechadas = ganhas + perdidas
    const taxaConversao = fechadas > 0 ? Math.round((ganhas / fechadas) * 100) : 0

    // (6) atividades (tarefas comerciais) atrasadas — count no banco.
    const [atrasadas] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(crmTarefas)
      .where(
        and(
          eq(crmTarefas.workspaceId, workspace.id),
          eq(crmTarefas.concluida, false),
          lt(crmTarefas.dataVencimento, new Date())
        )
      )
    const atividadesAtrasadas = atrasadas?.total ?? 0

    // (7) oportunidades COM ao menos uma tarefa concluída (Set em memória) —
    // insumo da heurística "sem contato".
    const comTarefaConcluida = await db
      .selectDistinct({ oportunidadeId: crmTarefas.oportunidadeId })
      .from(crmTarefas)
      .where(
        and(
          eq(crmTarefas.workspaceId, workspace.id),
          eq(crmTarefas.concluida, true),
          isNotNull(crmTarefas.oportunidadeId)
        )
      )
    const contatadas = new Set<string>()
    for (const t of comTarefaConcluida) {
      if (t.oportunidadeId) contatadas.add(t.oportunidadeId)
    }

    // (8) distribuição de origem das abertas — GROUP BY no banco.
    const origensRaw = await db
      .select({
        origem: crmOportunidades.origem,
        total: sql<number>`count(*)::int`,
      })
      .from(crmOportunidades)
      .where(
        and(eq(crmOportunidades.pipelineId, pipeline.id), eq(crmOportunidades.status, 'aberta'))
      )
      .groupBy(crmOportunidades.origem)

    const origens: OrigemDistrib[] = origensRaw.map((o) => ({
      // origem null -> 'outro' (mesmo fallback dos helpers de origem).
      origem: o.origem ?? 'outro',
      total: o.total,
      pct: totalOportunidades > 0 ? Math.round((o.total / totalOportunidades) * 100) : 0,
    }))

    // Merge em memória: monta os cards preenchendo createdAt e semContato.
    // Heurística semContato (DOCUMENTADA): uma oportunidade ABERTA está "sem
    // contato" quando foi criada há mais de 7 dias E não possui NENHUMA tarefa
    // concluída (id fora do Set do passo 7). O KPI semContato conta esses cards.
    const agora = Date.now()
    const porEtapa = new Map<string, OportunidadeCard[]>()
    let semContatoTotal = 0
    for (const o of abertas) {
      const criada = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)
      const semContato = agora - criada.getTime() > SETE_DIAS_MS && !contatadas.has(o.id)
      if (semContato) semContatoTotal += 1
      const card: OportunidadeCard = {
        id: o.id,
        titulo: o.titulo,
        valor: o.valor != null ? Number(o.valor) : null,
        tipoReceita: o.tipoReceita,
        etapaId: o.etapaId,
        ordemNaEtapa: o.ordemNaEtapa,
        origem: o.origem,
        contatoNome: o.contatoNome,
        empresaNome: o.empresaNome,
        dataPrevistaFechamento: o.dataPrevistaFechamento,
        createdAt: criada.toISOString(),
        semContato,
      }
      const lista = porEtapa.get(o.etapaId)
      if (lista) lista.push(card)
      else porEtapa.set(o.etapaId, [card])
    }

    const colunas: ColunaKanban[] = etapas.map((etapa) => {
      const oportunidades = porEtapa.get(etapa.id) ?? []
      return {
        etapa,
        oportunidades,
        total: oportunidades.length,
        somaValor: oportunidades.reduce((soma, o) => soma + (o.valor ?? 0), 0),
      }
    })

    const kpis: KpisCrm = {
      totalOportunidades,
      valorOrigem,
      taxaConversao,
      ganhas,
      atividadesAtrasadas,
      semContato: semContatoTotal,
    }

    return { configurado: true, pipelineNome: pipeline.nome, etapas, colunas, kpis, origens }
  } catch (e) {
    // Tabelas ainda não existem ou soluço de conexão: degrada graciosamente.
    console.error('[getCrmVisaoGeral]', e)
    return VISAO_VAZIA
  }
}
