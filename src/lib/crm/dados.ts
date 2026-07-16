import { and, asc, desc, eq, inArray, lt, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  crmAtividades,
  crmContatoTags,
  crmEmpresas,
  crmContatos,
  crmEtapas,
  crmPipelines,
  crmOportunidades,
  crmTags,
  crmTarefas,
  profiles,
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
  // Chave do serviço vendido (ver src/lib/crm/servicos.ts) — subtítulo do card.
  servico: string | null
  status: 'aberta' | 'ganha' | 'perdida'
  motivoPerda: string | null
  // É o contatoId que abre a ficha do lead no clique do card.
  contatoId: string | null
  contatoNome: string | null
  // Telefone só-dígitos do CONTATO — alimenta o botão WhatsApp do card
  // (oculto quando null). Ver normalizarTelefone (src/lib/crm/lead.ts).
  telefoneNormalizado: string | null
  // #N estável por ordem de criação no workspace (row_number sobre TODAS as
  // oportunidades) — o "#1" da imagem03. Sem coluna nova de propósito.
  numero: number
  // Tags do CONTATO (badges do rodapé do card). cor = chave de CORES_TAG.
  tags: { id: string; nome: string; cor: string }[]
  empresaNome: string | null
  // Atendente responsável (a UI mostra 'Sem atendente' quando null).
  donoNome: string | null
  qtdAtividades: number
  qtdTarefasAbertas: number
  dataPrevistaFechamento: string | null
  // Adicionados para o mockup: tempo relativo e aviso "Nao contatado".
  createdAt: string // ISO
  semContato: boolean
  // Preenchido quando o negócio GANHO já virou cliente da agência — o kanban
  // usa para NÃO reoferecer a conversão (dialog Converter em cliente).
  clienteId: string | null
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

// Colunas VIRTUAIS Ganho/Perdido (D-04): derivadas do STATUS da oportunidade —
// NUNCA viram linhas em crm_etapas (padrão Pipedrive, mantido).
export type ColunaFechada = {
  chave: 'ganho' | 'perdido'
  nome: string // 'Ganho' | 'Perdido'
  oportunidades: OportunidadeCard[] // até 50, as mais recentes
  total: number // total REAL no banco (de porStatus) — pode ser > 50
  somaValor: number // soma das CARREGADAS (não do total)
}

export type PipelineResumo = { id: string; nome: string; padrao: boolean }

export type Kanban = {
  // false = workspace/pipeline não existem (migration 0019 ainda não aplicada):
  // a página degrada graciosamente com aviso em vez de quebrar.
  configurado: boolean
  pipelineId: string | null
  pipelineNome: string | null
  // Todos os pipelines do workspace — alimenta o seletor do header.
  pipelines: PipelineResumo[]
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

export type CrmVisaoGeral = Kanban & {
  kpis: KpisCrm
  origens: OrigemDistrib[]
  colunasFechadas: ColunaFechada[]
}

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
  pipelineId: null,
  pipelineNome: null,
  pipelines: [],
  etapas: [],
  colunas: [],
  kpis: KPIS_ZERO,
  origens: [],
  colunasFechadas: [],
}

// Janela da heurística "sem contato": aberta há mais de 7 dias.
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

// Teto de linhas por coluna fechada. Ganho/Perdido só CRESCEM com o tempo: sem
// teto, a /crm ficaria mais lenta a cada mês que passa. O header mostra o total
// REAL (do porStatus), então o número exibido nunca mente — só a lista é cortada.
const TETO_FECHADAS = 50

// Colunas do card, reusadas pelas queries de abertas E de fechadas: mesma forma
// de linha → mesmo montarCard, sem risco de divergirem com o tempo.
const CAMPOS_CARD = {
  id: crmOportunidades.id,
  titulo: crmOportunidades.titulo,
  valor: crmOportunidades.valor,
  tipoReceita: crmOportunidades.tipoReceita,
  etapaId: crmOportunidades.etapaId,
  ordemNaEtapa: crmOportunidades.ordemNaEtapa,
  origem: crmOportunidades.origem,
  servico: crmOportunidades.servico,
  status: crmOportunidades.status,
  motivoPerda: crmOportunidades.motivoPerda,
  dataPrevistaFechamento: crmOportunidades.dataPrevistaFechamento,
  createdAt: crmOportunidades.createdAt,
  clienteId: crmOportunidades.clienteId,
  contatoId: crmOportunidades.contatoId,
  contatoNome: crmContatos.nome,
  contatoTelefoneNormalizado: crmContatos.telefoneNormalizado,
  empresaNome: crmEmpresas.nome,
  donoNome: profiles.nome,
}

type LinhaCard = {
  id: string
  titulo: string
  valor: string | null
  tipoReceita: string | null
  etapaId: string
  ordemNaEtapa: number
  origem: string | null
  servico: string | null
  status: string
  motivoPerda: string | null
  dataPrevistaFechamento: string | null
  createdAt: Date
  clienteId: string | null
  contatoId: string | null
  contatoNome: string | null
  contatoTelefoneNormalizado: string | null
  empresaNome: string | null
  donoNome: string | null
}

// Insumos agregados do card, agrupados num objeto só para o montarCard não
// virar uma assinatura de 6 Maps.
type InsumosCard = {
  atividadesPorOportunidade: Map<string, number>
  tarefasAbertasPorOportunidade: Map<string, number>
  numeroPorOportunidade: Map<string, number>
  tagsPorContato: Map<string, { id: string; nome: string; cor: string }[]>
}

// Helper LOCAL (não exportado): a montagem do card mora num lugar só — senão
// abertas e fechadas divergem silenciosamente.
function montarCard(o: LinhaCard, semContato: boolean, insumos: InsumosCard): OportunidadeCard {
  const criada = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)
  return {
    id: o.id,
    titulo: o.titulo,
    valor: o.valor != null ? Number(o.valor) : null,
    tipoReceita: o.tipoReceita,
    etapaId: o.etapaId,
    ordemNaEtapa: o.ordemNaEtapa,
    origem: o.origem,
    servico: o.servico,
    status: (o.status as OportunidadeCard['status']) ?? 'aberta',
    motivoPerda: o.motivoPerda,
    contatoId: o.contatoId,
    contatoNome: o.contatoNome,
    telefoneNormalizado: o.contatoTelefoneNormalizado,
    numero: insumos.numeroPorOportunidade.get(o.id) ?? 0,
    tags: o.contatoId ? (insumos.tagsPorContato.get(o.contatoId) ?? []) : [],
    empresaNome: o.empresaNome,
    donoNome: o.donoNome,
    qtdAtividades: insumos.atividadesPorOportunidade.get(o.id) ?? 0,
    qtdTarefasAbertas: insumos.tarefasAbertasPorOportunidade.get(o.id) ?? 0,
    dataPrevistaFechamento: o.dataPrevistaFechamento,
    createdAt: criada.toISOString(),
    semContato,
    clienteId: o.clienteId,
  }
}

// getCrmVisaoGeral é a ÚNICA fonte de dados da página /crm (substitui a antiga
// getKanban): entrega o kanban + os 6 KPIs + a distribuição de origem + as
// colunas virtuais Ganho/Perdido, tudo com queries sequenciais/agregadas.
// Degrada para VISAO_VAZIA sem quebrar.
export async function getCrmVisaoGeral(pipelineIdParam?: string): Promise<CrmVisaoGeral> {
  try {
    // (1) workspace único do v1 (null = 0019 não aplicada)
    const workspace = await getWorkspaceAtual()
    if (!workspace) return VISAO_VAZIA

    // (2) todos os pipelines do workspace (seletor) + o pipeline ATIVO:
    // o pedido via ?pipeline=id, senão o padrão, senão o primeiro.
    const pipelines = await db
      .select({ id: crmPipelines.id, nome: crmPipelines.nome, padrao: crmPipelines.padrao })
      .from(crmPipelines)
      .where(eq(crmPipelines.workspaceId, workspace.id))
      .orderBy(asc(crmPipelines.ordem), asc(crmPipelines.createdAt))

    const pipeline =
      pipelines.find((p) => p.id === pipelineIdParam) ??
      pipelines.find((p) => p.padrao) ??
      pipelines[0]

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
    // de contato/empresa/atendente via leftJoin (nada de N+1 por coluna).
    const abertas = await db
      .select(CAMPOS_CARD)
      .from(crmOportunidades)
      .leftJoin(crmContatos, eq(crmOportunidades.contatoId, crmContatos.id))
      .leftJoin(crmEmpresas, eq(crmOportunidades.empresaId, crmEmpresas.id))
      .leftJoin(profiles, eq(crmOportunidades.donoId, profiles.id))
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

    // (9)/(10) as FECHADAS — sem elas as colunas virtuais nasceriam vazias.
    // Duas queries sequenciais porque a ordenação difere (ganhaEm vs perdidaEm);
    // as mais RECENTES são as que interessam no board.
    const ganhasRows = await db
      .select(CAMPOS_CARD)
      .from(crmOportunidades)
      .leftJoin(crmContatos, eq(crmOportunidades.contatoId, crmContatos.id))
      .leftJoin(crmEmpresas, eq(crmOportunidades.empresaId, crmEmpresas.id))
      .leftJoin(profiles, eq(crmOportunidades.donoId, profiles.id))
      .where(
        and(eq(crmOportunidades.pipelineId, pipeline.id), eq(crmOportunidades.status, 'ganha'))
      )
      .orderBy(desc(crmOportunidades.ganhaEm))
      .limit(TETO_FECHADAS)

    const perdidasRows = await db
      .select(CAMPOS_CARD)
      .from(crmOportunidades)
      .leftJoin(crmContatos, eq(crmOportunidades.contatoId, crmContatos.id))
      .leftJoin(crmEmpresas, eq(crmOportunidades.empresaId, crmEmpresas.id))
      .leftJoin(profiles, eq(crmOportunidades.donoId, profiles.id))
      .where(
        and(eq(crmOportunidades.pipelineId, pipeline.id), eq(crmOportunidades.status, 'perdida'))
      )
      .orderBy(desc(crmOportunidades.perdidaEm))
      .limit(TETO_FECHADAS)

    // (11) atividades por oportunidade — GROUP BY no banco, NUNCA N+1 por card.
    const atividadesRaw = await db
      .select({
        oportunidadeId: crmAtividades.oportunidadeId,
        total: sql<number>`count(*)::int`,
      })
      .from(crmAtividades)
      .where(
        and(eq(crmAtividades.workspaceId, workspace.id), isNotNull(crmAtividades.oportunidadeId))
      )
      .groupBy(crmAtividades.oportunidadeId)

    const atividadesPorOportunidade = new Map<string, number>()
    for (const a of atividadesRaw) {
      if (a.oportunidadeId) atividadesPorOportunidade.set(a.oportunidadeId, a.total)
    }

    // (12) tarefas ABERTAS por oportunidade — mesmo formato agregado.
    const tarefasAbertasRaw = await db
      .select({
        oportunidadeId: crmTarefas.oportunidadeId,
        total: sql<number>`count(*)::int`,
      })
      .from(crmTarefas)
      .where(
        and(
          eq(crmTarefas.workspaceId, workspace.id),
          eq(crmTarefas.concluida, false),
          isNotNull(crmTarefas.oportunidadeId)
        )
      )
      .groupBy(crmTarefas.oportunidadeId)

    const tarefasAbertasPorOportunidade = new Map<string, number>()
    for (const t of tarefasAbertasRaw) {
      if (t.oportunidadeId) tarefasAbertasPorOportunidade.set(t.oportunidadeId, t.total)
    }

    // (13) #N por oportunidade — row_number sobre TODAS as oportunidades do
    // workspace por ordem de criação (uma query agregada; escala pequena).
    // Estável: a numeração nunca muda quando negócios são fechados/reabertos.
    const numeracaoRaw = await db
      .select({
        id: crmOportunidades.id,
        numero: sql<number>`(row_number() over (order by ${crmOportunidades.createdAt}, ${crmOportunidades.id}))::int`,
      })
      .from(crmOportunidades)
      .where(eq(crmOportunidades.workspaceId, workspace.id))

    const numeroPorOportunidade = new Map<string, number>()
    for (const n of numeracaoRaw) numeroPorOportunidade.set(n.id, n.numero)

    // (14) tags dos CONTATOS presentes no board — UMA query com inArray sobre
    // os contatoIds coletados (nunca N+1 por card).
    const contatoIds = new Set<string>()
    for (const o of abertas) if (o.contatoId) contatoIds.add(o.contatoId)
    for (const o of ganhasRows) if (o.contatoId) contatoIds.add(o.contatoId)
    for (const o of perdidasRows) if (o.contatoId) contatoIds.add(o.contatoId)

    const tagsPorContato = new Map<string, { id: string; nome: string; cor: string }[]>()
    if (contatoIds.size > 0) {
      const tagsRaw = await db
        .select({
          contatoId: crmContatoTags.contatoId,
          id: crmTags.id,
          nome: crmTags.nome,
          cor: crmTags.cor,
        })
        .from(crmContatoTags)
        .innerJoin(crmTags, eq(crmContatoTags.tagId, crmTags.id))
        .where(inArray(crmContatoTags.contatoId, [...contatoIds]))
        .orderBy(asc(crmTags.nome))
      for (const t of tagsRaw) {
        const lista = tagsPorContato.get(t.contatoId)
        const tag = { id: t.id, nome: t.nome, cor: t.cor }
        if (lista) lista.push(tag)
        else tagsPorContato.set(t.contatoId, [tag])
      }
    }

    const insumos: InsumosCard = {
      atividadesPorOportunidade,
      tarefasAbertasPorOportunidade,
      numeroPorOportunidade,
      tagsPorContato,
    }

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
      const card = montarCard(o, semContato, insumos)
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

    // semContato entra como false nas fechadas: é heurística de negócio ABERTO
    // ("aguardando contato há +7d") — um negócio já fechado não aguarda nada.
    const cardsGanhos = ganhasRows.map((o) => montarCard(o, false, insumos))
    const cardsPerdidos = perdidasRows.map((o) => montarCard(o, false, insumos))

    const colunasFechadas: ColunaFechada[] = [
      {
        chave: 'ganho',
        nome: 'Ganho',
        oportunidades: cardsGanhos,
        // total REAL do banco (porStatus) — não recontar aqui.
        total: ganhas,
        somaValor: cardsGanhos.reduce((soma, o) => soma + (o.valor ?? 0), 0),
      },
      {
        chave: 'perdido',
        nome: 'Perdido',
        oportunidades: cardsPerdidos,
        total: perdidas,
        somaValor: cardsPerdidos.reduce((soma, o) => soma + (o.valor ?? 0), 0),
      },
    ]

    const kpis: KpisCrm = {
      totalOportunidades,
      valorOrigem,
      taxaConversao,
      ganhas,
      atividadesAtrasadas,
      semContato: semContatoTotal,
    }

    return {
      configurado: true,
      pipelineId: pipeline.id,
      pipelineNome: pipeline.nome,
      pipelines,
      etapas,
      colunas,
      kpis,
      origens,
      colunasFechadas,
    }
  } catch (e) {
    // Tabelas ainda não existem ou soluço de conexão: degrada graciosamente.
    console.error('[getCrmVisaoGeral]', e)
    return VISAO_VAZIA
  }
}
