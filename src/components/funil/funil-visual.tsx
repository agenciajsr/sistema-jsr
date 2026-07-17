'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  funil: {
    novoLead: number
    agendado: number
    pagou: number
    taxaNovoAgendado: number
    taxaAgendadoPagou: number
  }
}

function formatarTaxa(taxa: number): string {
  return `${(Math.round(taxa * 10) / 10).toLocaleString('pt-BR')}%`
}

// Trapézio central da referência: 3 degraus decrescentes (100% → 66% → 36%),
// os dois de cima escuros e a base ("Pagou") verde; taxas de conversão embaixo.
export function FunilVisual({ funil }: Props) {
  const degraus = [
    {
      rotulo: 'Novo lead',
      valor: funil.novoLead,
      largura: '100%',
      classes: 'bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700',
      clip: 'polygon(0 0, 100% 0, 83% 100%, 17% 100%)',
    },
    {
      rotulo: 'Agendado',
      valor: funil.agendado,
      largura: '66%',
      classes: 'bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700',
      clip: 'polygon(0 0, 100% 0, 77% 100%, 23% 100%)',
    },
    {
      rotulo: 'Pagou',
      valor: funil.pagou,
      largura: '36%',
      classes: 'bg-emerald-500 text-white',
      clip: undefined,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-1">
          {degraus.map((d) => (
            <div
              key={d.rotulo}
              className={`flex h-20 flex-col items-center justify-center ${d.classes}`}
              style={{ width: d.largura, clipPath: d.clip }}
            >
              <span className="text-sm font-semibold">{d.rotulo}</span>
              <span className="text-lg font-bold tabular-nums">
                {d.valor.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Novo lead → Agendado</p>
            <p className="text-xl font-bold tabular-nums">{formatarTaxa(funil.taxaNovoAgendado)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Agendado → Pagou</p>
            <p className="text-xl font-bold tabular-nums">{formatarTaxa(funil.taxaAgendadoPagou)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
