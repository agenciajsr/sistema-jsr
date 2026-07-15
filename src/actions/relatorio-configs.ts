'use server'

import { eq, and, asc, desc, gte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/lib/db'
import { relatorioConfigs, relatorioBlocos, adAccounts, campaignInsights, clientes, relatorios } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { hojeBrasilia, dataMenosDias } from '@/lib/date-br'
import {
  calcularPeriodo,
  proximoEnvio,
  montarTextoRelatorio,
  type BlocoComMetricas,
} from '@/lib/relatorios/engine'
import { agregarContaPeriodo } from '@/lib/relatorios/gerar-relatorio'
import { gerarRelatorioDeConfig } from '@/lib/relatorios/gerar-relatorio-config'

// --- Validação ---

const blocoSchema = z.object({
  adAccountId: z.string().uuid('Selecione a conta de anúncio.'),
  nivel: z.enum(['conta', 'campanhas']),
  campanhasSelecionadas: z.array(z.string()).nullable().optional(),
  metricas: z.array(z.string()).min(1, 'Escolha ao menos 1 métrica no bloco.'),
  mensagem: z.string().trim().min(1, 'A mensagem do bloco não pode ficar vazia.'),
})

const configSchema = z
  .object({
    clienteId: z.string().uuid('Selecione o cliente.'),
    nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres.').max(80, 'Nome muito longo (máx. 80).'),
    frequencia: z.enum(['semanal', 'mensal']),
    diaSemana: z.number().int().min(0).max(6).nullable().optional(),
    diaMes: z.number().int().min(1).max(31).nullable().optional(),
    periodoDias: z.number().int().min(1).max(90).nullable().optional(),
    horarioEnvio: z.string().nullable().optional(),
    destinoTipo: z.enum(['privado', 'grupo']).nullable().optional(),
    destinoValor: z.string().nullable().optional(),
    cabecalho: z.string().trim().min(1, 'O cabeçalho não pode ficar vazio.'),
    incluirCompilado: z.boolean(),
    mensagemCompilado: z.string().nullable().optional(),
    blocos: z.array(blocoSchema).min(1, 'Adicione ao menos 1 bloco de métricas.'),
  })
  .superRefine((val, ctx) => {
    if (val.frequencia === 'semanal' && (val.diaSemana === null || val.diaSemana === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Escolha o dia da semana do envio.', path: ['diaSemana'] })
    }
    if (val.frequencia === 'mensal' && (val.diaMes === null || val.diaMes === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Escolha o dia do mês do envio.', path: ['diaMes'] })
    }
    val.blocos.forEach((b, i) => {
      if (b.nivel === 'campanhas' && (!b.campanhasSelecionadas || b.campanhasSelecionadas.length === 0)) {
        ctx.addIssue({ code: 'custom', message: 'Selecione ao menos 1 campanha.', path: ['blocos', i, 'campanhasSelecionadas'] })
      }
    })
  })

export type RelatorioConfigDraft = z.infer<typeof configSchema>

type Resultado = { success: true } | { success: false; error: string }

function primeiraMensagem(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Dados inválidos.'
}

// --- CRUD ---

export async function criarRelatorioConfig(draft: RelatorioConfigDraft): Promise<Resultado & { id?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const parsed = configSchema.safeParse(draft)
  if (!parsed.success) return { success: false, error: primeiraMensagem(parsed.error) }
  const d = parsed.data

  try {
    const id = await db.transaction(async (tx) => {
      const [config] = await tx
        .insert(relatorioConfigs)
        .values({
          clienteId: d.clienteId,
          nome: d.nome,
          frequencia: d.frequencia,
          diaSemana: d.frequencia === 'semanal' ? d.diaSemana : null,
          diaMes: d.frequencia === 'mensal' ? d.diaMes : null,
          periodoDias: d.periodoDias ?? null,
          horarioEnvio: d.horarioEnvio ?? null,
          destinoTipo: d.destinoTipo ?? null,
          destinoValor: d.destinoValor ?? null,
          cabecalho: d.cabecalho,
          incluirCompilado: d.incluirCompilado,
          mensagemCompilado: d.mensagemCompilado ?? null,
        })
        .returning({ id: relatorioConfigs.id })

      await tx.insert(relatorioBlocos).values(
        d.blocos.map((b, i) => ({
          configId: config.id,
          ordem: i,
          adAccountId: b.adAccountId,
          nivel: b.nivel,
          campanhasSelecionadas: b.nivel === 'campanhas' ? b.campanhasSelecionadas : null,
          metricas: b.metricas,
          mensagem: b.mensagem,
        })),
      )
      return config.id
    })

    revalidatePath('/relatorios')
    return { success: true, id }
  } catch (err) {
    console.error('[Relatórios] erro ao criar config:', err)
    return { success: false, error: 'Erro ao salvar a configuração.' }
  }
}

export async function atualizarRelatorioConfig(configId: string, draft: RelatorioConfigDraft): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const parsed = configSchema.safeParse(draft)
  if (!parsed.success) return { success: false, error: primeiraMensagem(parsed.error) }
  const d = parsed.data

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(relatorioConfigs)
        .set({
          clienteId: d.clienteId,
          nome: d.nome,
          frequencia: d.frequencia,
          diaSemana: d.frequencia === 'semanal' ? d.diaSemana : null,
          diaMes: d.frequencia === 'mensal' ? d.diaMes : null,
          periodoDias: d.periodoDias ?? null,
          horarioEnvio: d.horarioEnvio ?? null,
          destinoTipo: d.destinoTipo ?? null,
          destinoValor: d.destinoValor ?? null,
          cabecalho: d.cabecalho,
          incluirCompilado: d.incluirCompilado,
          mensagemCompilado: d.mensagemCompilado ?? null,
          updatedAt: new Date(),
        })
        .where(eq(relatorioConfigs.id, configId))

      // Replace simples dos blocos (poucos por config).
      await tx.delete(relatorioBlocos).where(eq(relatorioBlocos.configId, configId))
      await tx.insert(relatorioBlocos).values(
        d.blocos.map((b, i) => ({
          configId,
          ordem: i,
          adAccountId: b.adAccountId,
          nivel: b.nivel,
          campanhasSelecionadas: b.nivel === 'campanhas' ? b.campanhasSelecionadas : null,
          metricas: b.metricas,
          mensagem: b.mensagem,
        })),
      )
    })

    revalidatePath('/relatorios')
    return { success: true }
  } catch (err) {
    console.error('[Relatórios] erro ao atualizar config:', err)
    return { success: false, error: 'Erro ao salvar a configuração.' }
  }
}

export async function alternarAtivoRelatorioConfig(configId: string, ativo: boolean): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  try {
    await db
      .update(relatorioConfigs)
      .set({ ativo, updatedAt: new Date() })
      .where(eq(relatorioConfigs.id, configId))
    revalidatePath('/relatorios')
    return { success: true }
  } catch (err) {
    console.error('[Relatórios] erro ao alternar ativo:', err)
    return { success: false, error: 'Erro ao atualizar o status.' }
  }
}

export async function excluirRelatorioConfig(configId: string): Promise<Resultado> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  try {
    await db.delete(relatorioConfigs).where(eq(relatorioConfigs.id, configId))
    revalidatePath('/relatorios')
    return { success: true }
  } catch (err) {
    console.error('[Relatórios] erro ao excluir config:', err)
    return { success: false, error: 'Erro ao excluir a configuração.' }
  }
}

// --- Listagens ---

export type RelatorioConfigResumo = {
  id: string
  nome: string
  clienteId: string
  clienteNome: string
  frequencia: 'semanal' | 'mensal'
  diaSemana: number | null
  diaMes: number | null
  periodoDias: number | null
  horarioEnvio: string | null
  destinoTipo: string | null
  destinoValor: string | null
  cabecalho: string
  incluirCompilado: boolean
  mensagemCompilado: string | null
  ativo: boolean
  proximoEnvio: string | null // YYYY-MM-DD
  ultimoGerado: { conteudo: string; geradoEm: string; periodoInicio: string; periodoFim: string } | null
  blocos: {
    adAccountId: string
    nivel: 'conta' | 'campanhas'
    campanhasSelecionadas: string[] | null
    metricas: string[]
    mensagem: string
  }[]
}

export async function listarRelatorioConfigs(): Promise<RelatorioConfigResumo[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const configs = await db
    .select({
      config: relatorioConfigs,
      clienteNome: clientes.nome,
    })
    .from(relatorioConfigs)
    .innerJoin(clientes, eq(relatorioConfigs.clienteId, clientes.id))
    .orderBy(desc(relatorioConfigs.createdAt))

  const hoje = hojeBrasilia()
  const resultado: RelatorioConfigResumo[] = []

  for (const { config, clienteNome } of configs) {
    const blocos = await db
      .select()
      .from(relatorioBlocos)
      .where(eq(relatorioBlocos.configId, config.id))
      .orderBy(asc(relatorioBlocos.ordem))

    const [ultimo] = await db
      .select({
        conteudo: relatorios.conteudo,
        geradoEm: relatorios.geradoEm,
        periodoInicio: relatorios.periodoInicio,
        periodoFim: relatorios.periodoFim,
      })
      .from(relatorios)
      .where(eq(relatorios.configId, config.id))
      .orderBy(desc(relatorios.geradoEm))
      .limit(1)

    resultado.push({
      id: config.id,
      nome: config.nome,
      clienteId: config.clienteId,
      clienteNome,
      frequencia: config.frequencia as 'semanal' | 'mensal',
      diaSemana: config.diaSemana,
      diaMes: config.diaMes,
      periodoDias: config.periodoDias,
      horarioEnvio: config.horarioEnvio,
      destinoTipo: config.destinoTipo,
      destinoValor: config.destinoValor,
      cabecalho: config.cabecalho,
      incluirCompilado: config.incluirCompilado,
      mensagemCompilado: config.mensagemCompilado,
      ativo: config.ativo,
      ultimoGerado: ultimo
        ? {
            conteudo: ultimo.conteudo,
            geradoEm: ultimo.geradoEm.toISOString(),
            periodoInicio: ultimo.periodoInicio,
            periodoFim: ultimo.periodoFim,
          }
        : null,
      proximoEnvio: proximoEnvio(
        {
          frequencia: config.frequencia as 'semanal' | 'mensal',
          diaSemana: config.diaSemana,
          diaMes: config.diaMes,
          ativo: config.ativo,
        },
        hoje,
      ),
      blocos: blocos.map((b) => ({
        adAccountId: b.adAccountId,
        nivel: b.nivel as 'conta' | 'campanhas',
        campanhasSelecionadas: Array.isArray(b.campanhasSelecionadas) ? (b.campanhasSelecionadas as string[]) : null,
        metricas: Array.isArray(b.metricas) ? (b.metricas as string[]) : [],
        mensagem: b.mensagem,
      })),
    })
  }

  return resultado
}

export type ContaComCampanhas = {
  id: string
  nome: string
  campanhas: { campaignId: string; campaignName: string }[]
}

/**
 * Contas Meta ativas do cliente + campanhas distintas dos últimos 90 dias,
 * para a UI de seleção de blocos.
 */
export async function listarContasComCampanhas(clienteId: string): Promise<ContaComCampanhas[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const contas = await db
    .select({ id: adAccounts.id, nome: adAccounts.nome })
    .from(adAccounts)
    .where(
      and(
        eq(adAccounts.clienteId, clienteId),
        eq(adAccounts.plataforma, 'meta'),
        eq(adAccounts.ativo, true),
      ),
    )
    .orderBy(adAccounts.nome)

  const corte = dataMenosDias(90)
  const resultado: ContaComCampanhas[] = []

  for (const conta of contas) {
    const campanhas = await db
      .selectDistinctOn([campaignInsights.campaignId], {
        campaignId: campaignInsights.campaignId,
        campaignName: campaignInsights.campaignName,
        date: campaignInsights.date,
      })
      .from(campaignInsights)
      .where(and(eq(campaignInsights.adAccountId, conta.id), gte(campaignInsights.date, corte)))
      .orderBy(campaignInsights.campaignId, desc(campaignInsights.date))

    resultado.push({
      id: conta.id,
      nome: conta.nome,
      campanhas: campanhas
        .map((c) => ({ campaignId: c.campaignId, campaignName: c.campaignName }))
        .sort((a, b) => a.campaignName.localeCompare(b.campaignName, 'pt-BR')),
    })
  }

  return resultado
}

// --- Gerar agora (sob demanda, no formato da config) ---

export type GerarAgoraResultado =
  | { success: true; texto: string; periodo: { inicio: string; fim: string } }
  | { success: false; error: string }

/**
 * Gera o relatório de uma config AGORA (mesmo formato do cron) e salva no
 * histórico como tipo 'manual'. Usado no botão "Gerar agora" do card.
 */
export async function gerarRelatorioAgoraDaConfig(configId: string): Promise<GerarAgoraResultado> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  try {
    const relatorio = await gerarRelatorioDeConfig(configId)
    if (!relatorio) {
      return { success: false, error: 'Sem dados no período para as contas configuradas.' }
    }

    await db.insert(relatorios).values({
      clienteId: relatorio.clienteId,
      clienteNome: relatorio.clienteNome,
      tipo: 'manual',
      periodoInicio: relatorio.periodo.inicio,
      periodoFim: relatorio.periodo.fim,
      conteudo: relatorio.texto,
      configId,
    })

    revalidatePath('/relatorios')
    return { success: true, texto: relatorio.texto, periodo: relatorio.periodo }
  } catch (err) {
    console.error('[Relatórios] erro ao gerar agora:', err)
    return { success: false, error: 'Erro ao gerar o relatório.' }
  }
}

// --- Preview (sem persistir) ---

export type PreviewResultado =
  | { success: true; texto: string; periodo: { inicio: string; fim: string }; semDados: string[] }
  | { success: false; error: string }

/**
 * Gera o texto do relatório com dados REAIS do último período, a partir de um
 * draft (não precisa estar salvo). Nada é persistido.
 */
export async function previewRelatorio(draft: RelatorioConfigDraft): Promise<PreviewResultado> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const parsed = configSchema.safeParse(draft)
  if (!parsed.success) return { success: false, error: primeiraMensagem(parsed.error) }
  const d = parsed.data

  try {
    const cliente = await db.query.clientes.findFirst({
      where: eq(clientes.id, d.clienteId),
      columns: { nome: true },
    })
    if (!cliente) return { success: false, error: 'Cliente não encontrado.' }

    const periodo = calcularPeriodo(
      { frequencia: d.frequencia, periodoDias: d.periodoDias ?? null },
      hojeBrasilia(),
    )

    const blocosComMetricas: BlocoComMetricas[] = []
    const semDados: string[] = []

    for (let i = 0; i < d.blocos.length; i++) {
      const b = d.blocos[i]
      const conta = await db.query.adAccounts.findFirst({
        where: eq(adAccounts.id, b.adAccountId),
        columns: { id: true, nome: true },
      })
      if (!conta) {
        semDados.push(`Bloco ${i + 1}: conta não encontrada`)
        continue
      }

      const campanhaIds = b.nivel === 'campanhas' ? (b.campanhasSelecionadas ?? undefined) : undefined
      const agregado = await agregarContaPeriodo(conta, periodo.inicio, periodo.fim, campanhaIds ?? undefined)
      if (!agregado) {
        semDados.push(`${conta.nome}: sem dados no período`)
        continue
      }

      blocosComMetricas.push({
        bloco: { ordem: i, mensagem: b.mensagem, metricas: b.metricas },
        metricas: agregado.metricas,
      })
    }

    if (blocosComMetricas.length === 0) {
      return { success: false, error: 'Sem dados no período para as contas selecionadas.' }
    }

    const texto = montarTextoRelatorio(
      {
        cabecalho: d.cabecalho,
        incluirCompilado: d.incluirCompilado,
        mensagemCompilado: d.mensagemCompilado ?? null,
      },
      blocosComMetricas,
      periodo,
      cliente.nome,
    )

    return { success: true, texto, periodo, semDados }
  } catch (err) {
    console.error('[Relatórios] erro no preview:', err)
    return { success: false, error: 'Erro ao gerar o preview.' }
  }
}
