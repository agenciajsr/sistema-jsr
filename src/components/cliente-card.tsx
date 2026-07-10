import Link from 'next/link'
import { differenceInDays, format, parseISO } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContratoRow } from '@/lib/contratos/current'
import type { clientes } from '@/lib/db/schema'

type Cliente = typeof clientes.$inferSelect

// D-10: cores exatas de badge de status (01-UI-SPEC.md § Status Badge Colors).
const STATUS_LABEL: Record<Cliente['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

const STATUS_COLOR: Record<Cliente['status'], string> = {
  ativo: '#16A34A',
  pausado: '#D97706',
  encerrado: '#71717A',
}

const NICHO_LABEL: Record<Cliente['nicho'], string> = {
  ecommerce: 'E-commerce',
  negocio_local: 'Negócio Local',
  infoproduto: 'Infoproduto',
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

type ClienteCardProps = {
  cliente: Pick<Cliente, 'id' | 'nome' | 'nicho' | 'status'>
  contratoAtual: ContratoRow | null
}

export function ClienteCard({ cliente, contratoAtual }: ClienteCardProps) {
  return (
    <Link href={`/clientes/${cliente.id}`} className="block h-full">
      <Card className="h-full gap-4 p-6 transition-colors hover:bg-muted/40">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-[20px] leading-tight font-semibold">
              {cliente.nome}
            </CardTitle>
            <Badge
              style={{ backgroundColor: STATUS_COLOR[cliente.status] }}
              className="text-white"
            >
              {STATUS_LABEL[cliente.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-0 text-sm">
          <p className="text-muted-foreground">{NICHO_LABEL[cliente.nicho]}</p>
          <p className="font-medium">
            {contratoAtual
              ? formatadorMoeda.format(Number(contratoAtual.valorMensal))
              : 'Sem contrato registrado'}
          </p>
          {contratoAtual && (
            <p className="text-muted-foreground">
              {formatarVigencia(contratoAtual.dataVencimento)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

// Nota de escopo (01-UI-SPEC.md): texto neutro, SEM cor de alerta — lógica de
// alerta visual é escopo da Fase 3/4, não implementada nesta fase.
function formatarVigencia(dataVencimento: string): string {
  const vencimento = parseISO(dataVencimento)
  const dias = differenceInDays(vencimento, new Date())
  if (dias >= 0) {
    return `Faltam ${dias} dias`
  }
  return `Vencimento: ${format(vencimento, 'dd/MM/yyyy')}`
}
