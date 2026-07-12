'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck, FileX, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { updateTransacaoStatus } from '@/actions/financeiro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Conta = {
  id: string
  descricao: string
  valor: string
  data: string
  status: 'pago' | 'pendente' | 'vencido'
  clienteNome: string | null
  centroCusto: string | null
  formaPagamento: string | null
  responsavelNome: string | null
  comprovanteUrl: string | null
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const CENTRO_CUSTO_LABEL: Record<string, string> = {
  operacao: 'Operacao',
  midia: 'Midia',
  infraestrutura: 'Infraestrutura',
}

const FORMA_PGTO_LABEL: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao: 'Cartao',
  transferencia: 'Transferencia',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  pago: 'default',
  pendente: 'secondary',
  vencido: 'destructive',
}

export function ContasTable({ contas, tipo }: { contas: Conta[]; tipo: 'receita' | 'despesa' }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const total = contas.reduce((acc, c) => acc + Number(c.valor), 0)

  function handleMarcarPago(id: string) {
    startTransition(async () => {
      const result = await updateTransacaoStatus(id, '', 'pago')
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Marcado como pago.')
      router.refresh()
    })
  }

  if (contas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma conta registrada.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Descricao</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Centro de Custo</TableHead>
            <TableHead>Forma Pgto</TableHead>
            <TableHead>Responsavel</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Comprovante</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contas.map((c) => (
            <TableRow
              key={c.id}
              className={c.status === 'vencido' ? 'bg-destructive/5' : undefined}
            >
              <TableCell className="tabular-nums">{formatarData(c.data)}</TableCell>
              <TableCell className="font-medium">{c.descricao}</TableCell>
              <TableCell>{c.clienteNome ?? 'Agencia'}</TableCell>
              <TableCell>{c.centroCusto ? CENTRO_CUSTO_LABEL[c.centroCusto] ?? c.centroCusto : '-'}</TableCell>
              <TableCell>{c.formaPagamento ? FORMA_PGTO_LABEL[c.formaPagamento] ?? c.formaPagamento : '-'}</TableCell>
              <TableCell>{c.responsavelNome ?? '-'}</TableCell>
              <TableCell
                className={`text-right tabular-nums font-medium ${
                  tipo === 'receita' ? 'text-chart-success' : 'text-destructive'
                }`}
              >
                {formatadorMoeda.format(Number(c.valor))}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[c.status] ?? 'secondary'}>
                  {c.status === 'pago' ? 'Pago' : c.status === 'vencido' ? 'Vencido' : 'Pendente'}
                </Badge>
              </TableCell>
              <TableCell>
                {c.comprovanteUrl ? (
                  <a href={c.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-chart-success hover:text-chart-success/80">
                    <FileCheck className="size-4" />
                  </a>
                ) : (
                  <FileX className="size-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell>
                {c.status !== 'pago' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-chart-success"
                    disabled={isPending}
                    onClick={() => handleMarcarPago(c.id)}
                    title="Marcar como pago"
                  >
                    <CheckCircle className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end border-t pt-3">
        <p className="text-sm font-medium">
          Total: <span className={tipo === 'receita' ? 'text-chart-success' : 'text-destructive'}>{formatadorMoeda.format(total)}</span>
        </p>
      </div>
    </div>
  )
}
