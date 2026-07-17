// Card "Previsão por mês" (quick-260717-i26): somas mensais das receitas
// pendentes/vencidas FUTURAS — preserva a visão de MRR futuro sem listar
// dezenas de linhas na tabela. Server component simples, sem interação.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { labelMesPtBr } from '@/lib/financeiro/a-receber'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function PrevisaoPorMes({ meses }: { meses: { mes: string; total: number }[] }) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Previsão por mês</CardTitle>
      </CardHeader>
      <CardContent>
        {meses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma receita futura prevista.</p>
        ) : (
          <ul className="space-y-1">
            {meses.map((m) => (
              <li
                key={m.mes}
                className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm"
              >
                <span className="capitalize text-muted-foreground">{labelMesPtBr(m.mes)}</span>
                <span className="font-medium tabular-nums text-chart-success">
                  {formatadorMoeda.format(m.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
