/**
 * Geração de relatório a partir de uma CONFIG (relatorio_configs + relatorio_blocos).
 * Camada server (acessa o banco); a lógica pura vive em engine.ts.
 */

import { eq, asc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { relatorioConfigs, relatorioBlocos, adAccounts, clientes } from '@/lib/db/schema'
import { hojeBrasilia } from '@/lib/date-br'
import {
  calcularPeriodo,
  montarTextoRelatorio,
  type BlocoComMetricas,
  type Periodo,
} from './engine'
import { agregarContaPeriodo } from './gerar-relatorio'

export type RelatorioConfigGerado = {
  configId: string
  clienteId: string
  clienteNome: string
  texto: string
  periodo: Periodo
  totalBlocos: number
  blocosComDados: number
}

/**
 * Gera o texto do relatório de uma config. Retorna null se a config não existe,
 * não tem blocos ou NENHUM bloco tem dados no período.
 */
export async function gerarRelatorioDeConfig(
  configId: string,
  hoje: string = hojeBrasilia(),
): Promise<RelatorioConfigGerado | null> {
  const config = await db.query.relatorioConfigs.findFirst({
    where: eq(relatorioConfigs.id, configId),
  })
  if (!config) return null

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, config.clienteId),
    columns: { id: true, nome: true },
  })
  if (!cliente) return null

  const blocos = await db
    .select()
    .from(relatorioBlocos)
    .where(eq(relatorioBlocos.configId, configId))
    .orderBy(asc(relatorioBlocos.ordem))
  if (blocos.length === 0) return null

  const periodo = calcularPeriodo(
    { frequencia: config.frequencia as 'semanal' | 'mensal', periodoDias: config.periodoDias },
    hoje,
  )

  // Queries SEQUENCIAIS de propósito (pool max pequeno em serverless).
  const blocosComMetricas: BlocoComMetricas[] = []
  for (const bloco of blocos) {
    const conta = await db.query.adAccounts.findFirst({
      where: eq(adAccounts.id, bloco.adAccountId),
      columns: { id: true, nome: true },
    })
    if (!conta) continue

    const campanhaIds =
      bloco.nivel === 'campanhas' && Array.isArray(bloco.campanhasSelecionadas)
        ? (bloco.campanhasSelecionadas as string[])
        : undefined

    const agregado = await agregarContaPeriodo(conta, periodo.inicio, periodo.fim, campanhaIds)
    if (!agregado) continue

    blocosComMetricas.push({
      bloco: {
        ordem: bloco.ordem,
        mensagem: bloco.mensagem,
        metricas: Array.isArray(bloco.metricas) ? (bloco.metricas as string[]) : [],
      },
      metricas: agregado.metricas,
    })
  }

  if (blocosComMetricas.length === 0) return null

  const texto = montarTextoRelatorio(
    {
      cabecalho: config.cabecalho,
      incluirCompilado: config.incluirCompilado,
      mensagemCompilado: config.mensagemCompilado,
    },
    blocosComMetricas,
    periodo,
    cliente.nome,
  )

  return {
    configId: config.id,
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    texto,
    periodo,
    totalBlocos: blocos.length,
    blocosComDados: blocosComMetricas.length,
  }
}
