import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { Progress } from '@/components/ui/progress'
import { verbasAdsMock } from '@/lib/mock/extra'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const AJUSTE_CONFIG = {
  manter: { label: 'Manter', icon: Minus, variant: 'outline' as const },
  aumentar: { label: 'Aumentar', icon: ArrowUp, variant: 'secondary' as const },
  reduzir: { label: 'Reduzir', icon: ArrowDown, variant: 'destructive' as const },
}

export default function VerbasAdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verbas Ads</h1>
        <p className="text-sm text-muted-foreground">
          Controle e sugestão de ajuste de orçamento por cliente.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo (VBA-01, adicionado ao escopo em
        2026-07-10). As sugestões de ajuste são apenas ilustrativas — a lógica
        real de recomendação ainda não foi definida nem implementada.
      </MockNotice>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {verbasAdsMock.map((verba) => {
          const percentual = Math.round((verba.gastoAtual / verba.verbaMensal) * 100)
          const ajuste = AJUSTE_CONFIG[verba.ajusteSugerido]
          return (
            <Card key={verba.cliente} className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{verba.cliente}</CardTitle>
                  <p className="text-xs text-muted-foreground">{verba.plataforma}</p>
                </div>
                <Badge variant={ajuste.variant} className="gap-1">
                  <ajuste.icon className="size-3" />
                  {ajuste.label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatadorMoeda.format(verba.gastoAtual)} de{' '}
                    {formatadorMoeda.format(verba.verbaMensal)}
                  </span>
                  <span>{percentual}%</span>
                </div>
                <Progress value={percentual} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
