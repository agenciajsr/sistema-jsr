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
} from '@/actions/financeiro'
import { getProfiles } from '@/actions/clientes'

import { TransacaoForm } from './transacao-form'
import { TransacoesTable } from './transacoes-table'
import { ContasTable } from './contas-table'
import { PrevisaoCaixa } from './previsao-caixa'
import { MonthSelector } from './month-selector'

// Cinto de segurança: teto de execução da função serverless (rede de proteção
// contra 504 em cold start). Não é a cura — a causa é a amplificação de auth/DB.
export const maxDuration = 25

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

  const [resumo, mrr, transacoes, clientesAtivos, contasReceber, contasPagar, previsao, profilesList] = await Promise.all([
    getResumoFinanceiro(mes, ano),
    calcularMrr(),
    listTransacoes({ mes, ano }),
    db
      .select({ id: clientes.id, nome: clientes.nome })
      .from(clientes)
      .where(eq(clientes.status, 'ativo')),
    getContasAReceber(),
    getContasAPagar(),
    getPrevisaoCaixa(),
    getProfiles(),
  ])

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
        <MonthSelector mes={mes} ano={ano} />
      </div>

      {/* KPIs - sempre visiveis */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Receita Paga"
          value={formatadorMoeda.format(resumo.receita)}
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          label="Despesas Pagas"
          value={formatadorMoeda.format(resumo.despesa)}
          icon={TrendingDown}
          color="warning"
        />
        <StatCard
          label="Lucro"
          value={formatadorMoeda.format(resumo.lucro)}
          icon={DollarSign}
          color="primary"
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
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="geral">Visao Geral</TabsTrigger>
          <TabsTrigger value="receber">A Receber ({contasReceber.length})</TabsTrigger>
          <TabsTrigger value="pagar">A Pagar ({contasPagar.length})</TabsTrigger>
          <TabsTrigger value="previsao">Previsao</TabsTrigger>
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

        <TabsContent value="receber">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Contas a Receber</CardTitle>
            </CardHeader>
            <CardContent>
              <ContasTable contas={contasReceber} tipo="receita" />
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
      </Tabs>
    </div>
  )
}
