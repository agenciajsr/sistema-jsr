import { Layers } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ConjuntoRanking } from '@/lib/trafego/aggregate'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const formatadorNumero = new Intl.NumberFormat('pt-BR')

type Props = {
  topConjuntos: ConjuntoRanking[]
  labelHeroi: string
}

export function ConjuntosPerformam({ topConjuntos, labelHeroi }: Props) {
  if (topConjuntos.length === 0) {
    return (
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle className="text-base">Conjuntos que mais performam</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Layers className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Sincronize para ver os conjuntos de anúncio com melhor resultado.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">Conjuntos que mais performam</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conjunto</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">{labelHeroi}</TableHead>
              <TableHead className="text-right">Custo/result.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topConjuntos.map((c) => (
              <TableRow key={c.adsetId}>
                <TableCell className="font-medium">{c.adsetName}</TableCell>
                <TableCell className="text-right">
                  {formatadorMoeda.format(c.spend)}
                </TableCell>
                <TableCell className="text-right">
                  {formatadorNumero.format(c.resultadoPrimario)}
                </TableCell>
                <TableCell className="text-right">
                  {c.cpaOuCpl !== null ? formatadorMoeda.format(c.cpaOuCpl) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
