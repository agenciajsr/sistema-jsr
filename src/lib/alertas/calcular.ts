/**
 * Cálculo puro dos alertas atuais do sistema (sem sessão de usuário).
 *
 * Extraído de src/actions/alertas.ts para poder rodar tanto nas Server Actions
 * (com sessão) quanto no cron diário (sem usuário logado). NÃO altera nenhuma
 * regra de negócio — apenas orquestra as queries e os avaliadores existentes.
 */

import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { addDays, addHours, format } from 'date-fns'

import { db } from '@/lib/db'
import {
  contratos,
  transacoes,
  clientes,
  adAccounts,
  cobrancas,
  crmOportunidades,
  crmContatos,
  tarefas,
  tarefaChecklistItems,
} from '@/lib/db/schema'
import { SLA_PRIMEIRO_CONTATO_HORAS } from '@/lib/crm/sla-contato'
import {
  avaliarContratos,
  avaliarTransacoes,
  avaliarClientesInativos,
  avaliarSaldoContas,
  ordenarPorSeveridade,
} from '@/lib/alertas/avaliar'
import {
  avaliarCobrancas,
  avaliarAssinaturaPendente,
  avaliarSlaPrimeiroContato,
  avaliarOnboardingParado,
  avaliarRiscoChurn,
  DIAS_AVISO_FATURA,
  type CobrancaInput,
  type ContratoAssinaturaInput,
  type OportunidadeSlaInput,
  type OnboardingInput,
  type RiscoChurnInput,
} from '@/lib/alertas/avaliar-operacional'
import { getAlertasCampanhas } from '@/lib/saude/avaliar-campanhas'
import { getAlertasCampanhaDiarios } from '@/lib/alertas/regras-campanha'
import type { Alerta } from '@/lib/alertas/types'

/**
 * Avalia todas as fontes de alerta (contratos, transações, clientes, verba,
 * saúde de campanhas) e retorna a lista ordenada por severidade.
 */
export async function calcularAlertasAtuais(): Promise<Alerta[]> {
  const hoje = new Date()
  const limite30d = format(addDays(hoje, 30), 'yyyy-MM-dd')

  // 1. Contratos a vencer (inclui ja vencidos — sem lower bound)
  const contratosRows = await db
    .select({
      id: contratos.id,
      clienteId: contratos.clienteId,
      clienteNome: clientes.nome,
      dataVencimento: contratos.dataVencimento,
      valorMensal: contratos.valorMensal,
    })
    .from(contratos)
    .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
    .where(lte(contratos.dataVencimento, limite30d))

  // 2. Transacoes vencidas
  const transacoesRows = await db
    .select({
      id: transacoes.id,
      clienteId: transacoes.clienteId,
      clienteNome: clientes.nome,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      status: transacoes.status,
    })
    .from(transacoes)
    .leftJoin(clientes, eq(transacoes.clienteId, clientes.id))
    .where(eq(transacoes.status, 'vencido'))

  // 3. Clientes inativos
  const clientesRows = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      status: clientes.status,
    })
    .from(clientes)
    .where(
      eq(clientes.status, 'pausado'),
    )

  // Buscar encerrados separadamente (drizzle nao suporta IN com pgEnum facilmente)
  const clientesEncerrados = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      status: clientes.status,
    })
    .from(clientes)
    .where(
      eq(clientes.status, 'encerrado'),
    )

  const todosClientes = [...clientesRows, ...clientesEncerrados]

  // 4. Contas de anuncio com saldo baixo
  const contasRows = await db
    .select({
      id: adAccounts.id,
      nome: adAccounts.nome,
      clienteId: adAccounts.clienteId,
      clienteNome: clientes.nome,
      saldo: adAccounts.saldo,
    })
    .from(adAccounts)
    .leftJoin(clientes, eq(adAccounts.clienteId, clientes.id))
    .where(eq(adAccounts.ativo, true))

  // Avaliar
  const alertasContratos = avaliarContratos(contratosRows)
  const alertasTransacoes = avaliarTransacoes(transacoesRows)
  const alertasClientes = avaliarClientesInativos(todosClientes)
  const alertasSaldo = avaliarSaldoContas(contasRows)

  // Alertas de saúde de campanha (Meta): comparação de períodos sobre insights.
  // Envolvido em try/catch — uma falha aqui (ex.: sem dados Meta) NÃO pode
  // derrubar os demais alertas, que sempre precisam retornar.
  let alertasCampanhas: Alerta[] = []
  try {
    alertasCampanhas = await getAlertasCampanhas()
  } catch (erro) {
    console.error('[calcularAlertasAtuais] falha ao avaliar saúde de campanhas — ignorando', erro)
    alertasCampanhas = []
  }

  // Regras DIÁRIAS por campanha/anúncio/conta (Feature 2 — 17/jul/2026).
  // getAlertasCampanhaDiarios já é à prova de falha (retorna [] em erro).
  const alertasDiarios = await getAlertasCampanhaDiarios()

  // --- Alertas operacionais internos (quick-260717-qq6) ---
  // Queries SEQUENCIAIS (pool max=3, nunca Promise.all), cada bloco com
  // try/catch próprio: uma falha aqui NUNCA derruba os demais alertas.

  // (a) Régua de inadimplência interna: pendentes vencendo em ≤3 dias + vencidas.
  let alertasFaturas: Alerta[] = []
  try {
    const limiteFatura = format(addDays(hoje, DIAS_AVISO_FATURA), 'yyyy-MM-dd')
    const cobrancasRows: CobrancaInput[] = await db
      .select({
        id: cobrancas.id,
        clienteId: cobrancas.clienteId,
        clienteNome: clientes.nome,
        valor: cobrancas.valor,
        status: cobrancas.status,
        vencimento: cobrancas.vencimento,
      })
      .from(cobrancas)
      .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id))
      .where(
        or(
          and(eq(cobrancas.status, 'pendente'), lte(cobrancas.vencimento, limiteFatura)),
          eq(cobrancas.status, 'vencida'),
        ),
      )
    alertasFaturas = avaliarCobrancas(cobrancasRows, hoje)
  } catch (erro) {
    console.error('[calcularAlertasAtuais] falha ao avaliar cobrancas — ignorando', erro)
  }

  // (b) Contratos parados em aguardando_assinatura.
  let alertasAssinatura: Alerta[] = []
  try {
    const assinaturaRows: ContratoAssinaturaInput[] = await db
      .select({
        id: contratos.id,
        clienteId: contratos.clienteId,
        clienteNome: clientes.nome,
        statusFluxo: contratos.statusFluxo,
        enviadoParaAssinaturaEm: contratos.enviadoParaAssinaturaEm,
        createdAt: contratos.createdAt,
      })
      .from(contratos)
      .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
      .where(eq(contratos.statusFluxo, 'aguardando_assinatura'))
    alertasAssinatura = avaliarAssinaturaPendente(assinaturaRows, hoje)
  } catch (erro) {
    console.error('[calcularAlertasAtuais] falha ao avaliar assinaturas pendentes — ignorando', erro)
  }

  // (c) SLA de 1º contato do CRM. try/catch OBRIGATÓRIO: a coluna
  // primeiro_contato_em (migration 0034) pode ainda não existir no banco —
  // degradação graciosa no padrão do getWorkspaceAtual.
  let alertasSla: Alerta[] = []
  try {
    const slaRows = await db
      .select({
        id: crmOportunidades.id,
        titulo: crmOportunidades.titulo,
        contatoNome: crmContatos.nome,
        status: crmOportunidades.status,
        criadaEm: crmOportunidades.createdAt,
        primeiroContatoEm: crmOportunidades.primeiroContatoEm,
      })
      .from(crmOportunidades)
      .leftJoin(crmContatos, eq(crmOportunidades.contatoId, crmContatos.id))
      .where(
        and(
          eq(crmOportunidades.status, 'aberta'),
          isNull(crmOportunidades.primeiroContatoEm),
          // Corte grosso no banco: só leads criados há mais tempo que o SLA importam.
          lte(crmOportunidades.createdAt, addHours(hoje, -SLA_PRIMEIRO_CONTATO_HORAS)),
        ),
      )
    const slaInputs: OportunidadeSlaInput[] = slaRows.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      contatoNome: r.contatoNome,
      status: r.status,
      criadaEm: r.criadaEm instanceof Date ? r.criadaEm : new Date(r.criadaEm),
      primeiroContatoEm: r.primeiroContatoEm,
    }))
    alertasSla = avaliarSlaPrimeiroContato(slaInputs, hoje)
  } catch (erro) {
    console.error(
      '[calcularAlertasAtuais] falha ao avaliar SLA de 1º contato (migration 0034 pendente?) — ignorando',
      erro,
    )
  }

  // (d) Onboarding parado: clientes com itens pendentes há mais de 7 dias.
  // (gp5): a fonte é o checklist da TAREFA do processo (etiqueta técnica
  // processo:onboarding em tarefas.etiquetas), não mais processo_itens.
  let alertasOnboarding: Alerta[] = []
  try {
    const onboardingRows = await db
      .select({
        clienteId: tarefas.clienteId,
        clienteNome: clientes.nome,
        pendentes: sql<number>`count(*) FILTER (WHERE NOT ${tarefaChecklistItems.concluido})::int`,
        iniciadoEm: sql<Date>`min(${tarefas.createdAt})`,
      })
      .from(tarefas)
      .innerJoin(tarefaChecklistItems, eq(tarefaChecklistItems.tarefaId, tarefas.id))
      .innerJoin(clientes, eq(tarefas.clienteId, clientes.id))
      .where(
        and(
          eq(tarefas.ehMolde, false),
          sql`${tarefas.etiquetas} @> '["processo:onboarding"]'::jsonb`,
        ),
      )
      .groupBy(tarefas.clienteId, clientes.nome)
    const onboardingInputs: OnboardingInput[] = onboardingRows
      .filter((r) => r.clienteId !== null)
      .map((r) => ({
        clienteId: r.clienteId as string,
        clienteNome: r.clienteNome,
        pendentes: r.pendentes,
        iniciadoEm: r.iniciadoEm instanceof Date ? r.iniciadoEm : new Date(r.iniciadoEm),
      }))
    alertasOnboarding = avaliarOnboardingParado(onboardingInputs, hoje)
  } catch (erro) {
    console.error('[calcularAlertasAtuais] falha ao avaliar onboarding — ignorando', erro)
  }

  // (e) Risco de churn: cliente ATIVO com fatura vencida → sugerir atenção.
  let alertasChurn: Alerta[] = []
  try {
    const churnRows: RiscoChurnInput[] = await db
      .select({
        clienteId: clientes.id,
        clienteNome: clientes.nome,
        status: clientes.status,
        faturasVencidas: sql<number>`count(*)::int`,
      })
      .from(cobrancas)
      .innerJoin(clientes, eq(cobrancas.clienteId, clientes.id))
      .where(eq(cobrancas.status, 'vencida'))
      .groupBy(clientes.id, clientes.nome, clientes.status)
    alertasChurn = avaliarRiscoChurn(churnRows)
  } catch (erro) {
    console.error('[calcularAlertasAtuais] falha ao avaliar risco de churn — ignorando', erro)
  }

  // Unificar e ordenar
  return ordenarPorSeveridade([
    ...alertasContratos,
    ...alertasTransacoes,
    ...alertasClientes,
    ...alertasSaldo,
    ...alertasCampanhas,
    ...alertasDiarios,
    ...alertasFaturas,
    ...alertasAssinatura,
    ...alertasSla,
    ...alertasOnboarding,
    ...alertasChurn,
  ])
}
