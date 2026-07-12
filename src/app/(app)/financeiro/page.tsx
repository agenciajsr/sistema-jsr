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

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default async function FinanceiroPage() {
  const [resumo, mrr, transacoes, clientesAtivos, contasReceber, contasPagar, previsao, profilesList] = await Promise.all([
    getResumoFinanceiro(),
    calcularMrr(),
    listTransacoes(),
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
    clienteNome: t.clienteNome,
    descricao: t.descricao,
    valor: t.valor,
    data: t.data,
    status: t.status,
    centroCusto: t.centroCusto,
    formaPagamento: t.formaPagamento,
    responsavelNome: t.responsavelNome,
    comprovanteUrl: t.comprovanteUrl,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Receitas, despesas, lucro e MRR da agencia em tempo real.
        </p>
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
        <TabsList>
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
              <TransacoesTable transacoes={transacoesParaTabela} />
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
