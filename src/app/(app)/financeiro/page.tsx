import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { eq } from 'drizzle-orm'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { getResumoFinanceiro, calcularMrr, listTransacoes } from '@/actions/financeiro'

import { TransacaoForm } from './transacao-form'
import { TransacoesTable } from './transacoes-table'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default async function FinanceiroPage() {
  const [resumo, mrr, transacoes, clientesAtivos] = await Promise.all([
    getResumoFinanceiro(),
    calcularMrr(),
    listTransacoes(),
    db
      .select({ id: clientes.id, nome: clientes.nome })
      .from(clientes)
      .where(eq(clientes.status, 'ativo')),
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
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Receitas, despesas, lucro e MRR da agencia em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receita do Mes"
          value={formatadorMoeda.format(resumo.receita)}
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          label="Despesas do Mes"
          value={formatadorMoeda.format(resumo.despesa)}
          icon={TrendingDown}
          color="warning"
        />
        <StatCard
          label="Lucro do Mes"
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
      </div>

      <TransacaoForm clientes={clientesAtivos} />

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Transacoes do Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <TransacoesParaTabela transacoes={transacoesParaTabela} />
        </CardContent>
      </Card>
    </div>
  )
}

function TransacoesParaTabela({ transacoes }: { transacoes: Parameters<typeof TransacoesTable>[0]['transacoes'] }) {
  return <TransacoesTable transacoes={transacoes} />
}
