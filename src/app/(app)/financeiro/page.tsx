import { ArrowDownCircle, ArrowUpCircle, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { eq } from 'drizzle-orm'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatCard } from '@/components/stat-card'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import {
  getResumoFinanceiro,
  calcularMrr,
  listTransacoes,
  getContasAReceber,
  getContasAPagar,
  getPrevisaoCaixa,
  getVisaoAnalitica,
  getPrevisaoReceitaPorMes,
  getVisaoExecutiva,
} from '@/actions/financeiro'
import { getProfiles } from '@/actions/clientes'
import { getVisaoCobrancas } from '@/lib/cobrancas/dados'
import { asaasDisponivel } from '@/lib/asaas/client'
import { getCurrentUser } from '@/lib/auth/session'
import { withRetry } from '@/lib/utils/with-retry'
import { hojeBrasilia } from '@/lib/date-br'
import { progressoDoMes } from '@/lib/financeiro/calculos'
import { filtrarAReceber } from '@/lib/financeiro/a-receber'

import { TransacaoForm } from './transacao-form'
import { TransacoesTable } from './transacoes-table'
import { ContasTable } from './contas-table'
import { PrevisaoCaixa } from './previsao-caixa'
import { VisaoAnalitica } from './visao-analitica'
import { CobrancasTab } from './cobrancas-tab'
import { PrevisaoPorMes } from './previsao-por-mes'
import { MonthSelector } from './month-selector'

// Cinto de segurança: teto de execução da função serverless (rede de proteção
// contra 504 em cold start). Não é a cura — a causa é a amplificação de auth/DB.
export const maxDuration = 60

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const params = await searchParams
  const agora = new Date()
  const mes = params.mes ? Number(params.mes) : agora.getMonth() + 1
  const ano = params.ano ? Number(params.ano) : agora.getFullYear()

  // Estratégia anti-travamento (nesta ordem):
  // 1. Aquecimento: valida a sessão e abre UMA conexão antes das queries.
  // 2. Carga em 2 lotes sequenciais de 4 (achata o pico de conexões frias).
  // 3. Retry automático (withRetry) — o "F5 automático" — antes de desistir,
  //    com delay de 3s entre as tentativas: dá tempo de parte das queries
  //    órfãs da 1ª tentativa concluírem (são selects que terminam sozinhos)
  //    ou serem mortas pelo statement_timeout, liberando conexões do pool
  //    (max=5) antes da 2ª tentativa — quebra a cascata de 15/jul/2026.
  // 4. Tela de erro estática só como ÚLTIMO recurso (2 tentativas falharam).
  await getCurrentUser()

  // Factory (não Promise pronta): cada tentativa do withRetry redispara as
  // queries do zero — a 2ª tentativa pega as conexões já quentes do pool.
  const carregarDados = async () => {
    // Lote 1: disparar as 9 queries de uma vez força conexões frias extras no
    // pico do cold start — 2 lotes sequenciais (4+5) achatam esse pico. Mesmo
    // com pool max=5, os lotes continuam sequenciais (decisão do STATE.md:
    // nada de paralelismo além do padrão atual).
    const [resumo, mrr, transacoes, clientesAtivos] = await Promise.all([
      getResumoFinanceiro(mes, ano),
      calcularMrr(),
      listTransacoes({ mes, ano }),
      db
        .select({ id: clientes.id, nome: clientes.nome })
        .from(clientes)
        .where(eq(clientes.status, 'ativo')),
    ])
    // Lote 2: reaproveita as conexões já quentes do lote 1.
    const [contasReceber, contasPagar, previsao, profilesList, visaoAnalitica] = await Promise.all([
      getContasAReceber(),
      getContasAPagar(),
      getPrevisaoCaixa(),
      getProfiles(),
      getVisaoAnalitica(mes, ano),
    ])
    // Fetch SEQUENCIAL depois do lote 2 (não engordar os Promise.all): visão
    // consolidada da aba Cobranças (quick-260716-sr5).
    const visaoCobrancas = await getVisaoCobrancas()
    // Também SEQUENCIAL (regra do pool max=5 — nunca engordar os Promise.all):
    // previsão de receita por mês futuro, agregada no banco (quick-260717-i26).
    const previsaoMeses = await getPrevisaoReceitaPorMes()
    // Também SEQUENCIAL (nunca engordar os Promise.all): visão executiva —
    // churn, LTV e motivos de encerramento (quick-260719-wwm). null =
    // migration 0038 pendente, a UI degrada com aviso.
    const visaoExecutiva = await getVisaoExecutiva()
    return [
      resumo,
      mrr,
      transacoes,
      clientesAtivos,
      contasReceber,
      contasPagar,
      previsao,
      profilesList,
      visaoAnalitica,
      visaoCobrancas,
      previsaoMeses,
      visaoExecutiva,
    ] as const
  }

  let dados
  try {
    dados = await withRetry(carregarDados, {
      timeoutMs: 12_000, // 1ª tentativa: falha rápido no soluço do pooler
      retryTimeoutMs: 15_000, // 2ª tentativa: conexões já quentes — o "F5 automático"
      delayMs: 3_000, // espera queries órfãs da 1ª tentativa liberarem o pool
      label: 'financeiro-load',
    })
  } catch {
    // Último recurso: as DUAS tentativas falharam. Tela limpa de "recarregar"
    // em vez de congelar até o maxDuration e virar 504.
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-semibold">Financeiro indisponível no momento</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Houve uma instabilidade momentânea ao carregar os dados. Recarregue a página — costuma
          resolver na hora.
        </p>
        <a
          href="/financeiro"
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Recarregar
        </a>
      </div>
    )
  }

  const [
    resumo,
    mrr,
    transacoes,
    clientesAtivos,
    contasReceber,
    contasPagar,
    previsao,
    profilesList,
    visaoAnalitica,
    visaoCobrancas,
    previsaoMeses,
    visaoExecutiva,
  ] = dados

  // Contagem do badge da aba: clientes que precisam de atenção este mês
  // (fatura pendente/vencida ou ainda sem fatura gerada).
  const cobrancasAtencao = visaoCobrancas.filter(
    (l) => !l.fatura || l.fatura.status === 'pendente' || l.fatura.status === 'vencida',
  ).length

  // Chip de progresso só faz sentido no mês corrente (em Brasília).
  const hoje = hojeBrasilia()
  const [anoHoje, mesHoje] = hoje.split('-').map(Number)
  const isMesCorrente = mes === mesHoje && ano === anoHoje
  const prog = progressoDoMes(hoje)

  // Contagem do TabsTrigger "A Receber" reflete a visão padrão (próximos
  // 30 dias + vencidas). O KPI resumo.aReceber segue INTOCADO.
  const contasReceberPadrao = filtrarAReceber(contasReceber, hoje, false)

  // Sem base de comparação (mês anterior zerado) a variação é null => sem trend.
  const trendDe = (variacao: number | null, subirEBom: boolean) =>
    variacao === null
      ? undefined
      : {
          value: `${Math.abs(variacao)}%`,
          direction: (variacao >= 0 ? 'up' : 'down') as 'up' | 'down',
          positive: subirEBom ? variacao >= 0 : variacao < 0,
        }

  const transacoesParaTabela = transacoes.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    categoria: t.categoria,
    clienteId: t.clienteId,
    clienteNome: t.clienteNome,
    descricao: t.descricao,
    valor: t.valor,
    data: t.data,
    status: t.status,
    diaVencto: t.diaVencto,
    notas: t.notas,
    centroCusto: t.centroCusto,
    recorrencia: t.recorrencia,
    formaPagamento: t.formaPagamento,
    responsavelId: t.responsavelId,
    responsavelNome: t.responsavelNome,
    comprovanteUrl: t.comprovanteUrl,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Receitas, despesas, lucro e MRR da agencia em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector mes={mes} ano={ano} />
          {isMesCorrente && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
              Dia {prog.dia}/{prog.diasNoMes} ({prog.percentual}%)
            </span>
          )}
        </div>
      </div>

      {/* KPIs - sempre visiveis */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Receita Paga"
          value={formatadorMoeda.format(resumo.receita)}
          icon={TrendingUp}
          color="success"
          helper={`mes ant. ${formatadorMoeda.format(visaoAnalitica.mesAnterior.receita)}`}
          trend={trendDe(visaoAnalitica.variacao.receita, true)}
        />
        <StatCard
          label="Despesas Pagas"
          value={formatadorMoeda.format(resumo.despesa)}
          icon={TrendingDown}
          color="warning"
          helper={`mes ant. ${formatadorMoeda.format(visaoAnalitica.mesAnterior.despesa)}`}
          // Despesa subindo é ruim => trend vermelho quando a variação é positiva.
          trend={trendDe(visaoAnalitica.variacao.despesa, false)}
        />
        <StatCard
          label="Lucro"
          value={formatadorMoeda.format(resumo.lucro)}
          icon={DollarSign}
          color="primary"
          helper={`mes ant. ${formatadorMoeda.format(visaoAnalitica.mesAnterior.lucro)}`}
          trend={trendDe(visaoAnalitica.variacao.lucro, true)}
        />
        <StatCard
          label="MRR"
          value={formatadorMoeda.format(mrr)}
          icon={Wallet}
          color="success"
        />
        <StatCard
          label="A Receber"
          value={formatadorMoeda.format(resumo.aReceber)}
          icon={ArrowDownCircle}
          color="success"
          helper={`${contasReceber.length} cobrancas pendentes`}
        />
        <StatCard
          label="A Pagar"
          value={formatadorMoeda.format(resumo.aPagar)}
          icon={ArrowUpCircle}
          color="warning"
        />
      </div>

      <TransacaoForm clientes={clientesAtivos} responsaveis={profilesList} />

      {/* Abas */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Visao Geral</TabsTrigger>
          <TabsTrigger value="receber">A Receber ({contasReceberPadrao.length})</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças ({cobrancasAtencao})</TabsTrigger>
          <TabsTrigger value="pagar">A Pagar ({contasPagar.length})</TabsTrigger>
          <TabsTrigger value="previsao">Previsao</TabsTrigger>
          <TabsTrigger value="analitica">Visao Analitica</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Transacoes do Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <TransacoesTable
                transacoes={transacoesParaTabela}
                clientes={clientesAtivos}
                responsaveis={profilesList}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receber" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <PrevisaoPorMes meses={previsaoMeses} />
            </div>
            <Card className="border-none shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Contas a Receber</CardTitle>
              </CardHeader>
              <CardContent>
                <ContasTable contas={contasReceber} tipo="receita" hoje={hoje} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cobrancas">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cobranças do Mês por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <CobrancasTab linhas={visaoCobrancas} asaasConfigurado={asaasDisponivel()} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagar">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Contas a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <ContasTable contas={contasPagar} tipo="despesa" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="previsao">
          <PrevisaoCaixa previsao={previsao} />
        </TabsContent>

        <TabsContent value="analitica">
          <VisaoAnalitica dados={visaoAnalitica} executiva={visaoExecutiva} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
