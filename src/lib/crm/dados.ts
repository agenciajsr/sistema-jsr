import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { crmEmpresas, crmContatos, crmEtapas, crmPipelines, crmOportunidades } from '@/lib/db/schema'
import { getWorkspaceAtual } from '@/lib/crm/workspace'

// Módulo server comum — SEM 'use server': é chamado direto pelo Server Component
// da página /crm, não pelo client. Evita expor um endpoint desnecessário.
//
// ⚠️ QUERIES SEQUENCIAIS E AGREGADAS (nada de paralelizar com Promise, nada de
// N+1 por coluna): pool max=3 com max_pipeline=0 — ver src/lib/db/index.ts.
// O número de queries NÃO cresce com o nº de oportunidades.

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

const KANBAN_VAZIO: Kanban = { configurado: false, pipelineNome: null, etapas: [], colunas: [] }

export async function getKanban(): Promise<Kanban> {
  try {
    // (1) workspace único do v1 (null = 0019 não aplicada)
    const workspace = await getWorkspaceAtual()
    if (!workspace) return KANBAN_VAZIO

    // (2) pipeline padrão
    const [pipeline] = await db
      .select({ id: crmPipelines.id, nome: crmPipelines.nome })
      .from(crmPipelines)
      .where(and(eq(crmPipelines.workspaceId, workspace.id), eq(crmPipelines.padrao, true)))
      .limit(1)

    if (!pipeline) return KANBAN_VAZIO

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
    // de contato/empresa via leftJoin (nada de N+1 por coluna).
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

    // Merge em memória: colunas = etapas + oportunidades + total + soma de valor.
    const porEtapa = new Map<string, OportunidadeCard[]>()
    for (const o of abertas) {
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

    return { configurado: true, pipelineNome: pipeline.nome, etapas, colunas }
  } catch (e) {
    // Tabelas ainda não existem ou soluço de conexão: degrada graciosamente.
    console.error('[getKanban]', e)
    return KANBAN_VAZIO
  }
}
