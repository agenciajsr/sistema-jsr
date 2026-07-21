'use client'

import { useMemo, useState, useTransition } from 'react'
import { FileCheck, FileX, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { updateTransacaoStatus } from '@/actions/financeiro'
import { filtrarAReceber } from '@/lib/financeiro/a-receber'
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

export function ContasTable({
  contas,
  tipo,
  hoje,
}: {
  contas: Conta[]
  tipo: 'receita' | 'despesa'
  // 'YYYY-MM-DD' vindo do servidor (hojeBrasilia) — evita divergência server/client.
  hoje?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [mostrarTodas, setMostrarTodas] = useState(false)
  // Ids marcados como pago nesta sessão: somem da tela na hora (a lista mostra só
  // pendente/vencido), SEM router.refresh() da página pesada — que congelava o
  // /financeiro e deixava conexão zumbi (debug 260721). Já persistiu no banco.
  const [pagos, setPagos] = useState<Set<string>>(new Set())

  const contasVisiveis = useMemo(
    () => contas.filter((c) => !pagos.has(c.id)),
    [contas, pagos],
  )

  // Filtro padrão SÓ na aba de receitas (quick-260717-i26): próximos 30 dias
  // + vencidas. Despesas seguem com a lista completa, como sempre.
  const filtroAtivo = tipo === 'receita' && !!hoje
  const contasExibidas = filtroAtivo
    ? filtrarAReceber(contasVisiveis, hoje, mostrarTodas)
    : contasVisiveis

  // Total do rodapé usa a lista FILTRADA exibida.
  const total = contasExibidas.reduce((acc, c) => acc + Number(c.valor), 0)

  function handleMarcarPago(id: string) {
    startTransition(async () => {
      const result = await updateTransacaoStatus(id, '', 'pago')
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Marcado como pago.')
      setPagos((prev) => new Set(prev).add(id))
    })
  }

  if (contasVisiveis.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma conta registrada.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtroAtivo && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {mostrarTodas
              ? `Mostrando todas as ${contasVisiveis.length} contas`
              : `Mostrando ${contasExibidas.length} de ${contasVisiveis.length} — próximos 30 dias + vencidas`}
          </p>
          <Button variant="outline" size="sm" onClick={() => setMostrarTodas((v) => !v)}>
            {mostrarTodas ? 'Mostrar próximos 30 dias' : 'Mostrar todas'}
          </Button>
        </div>
      )}
      {contasExibidas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma conta nos próximos 30 dias. Use “Mostrar todas” para ver as demais.
        </div>
      ) : (
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
          {contasExibidas.map((c) => (
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
      )}
      <div className="flex justify-end border-t pt-3">
        <p className="text-sm font-medium">
          Total: <span className={tipo === 'receita' ? 'text-chart-success' : 'text-destructive'}>{formatadorMoeda.format(total)}</span>
        </p>
      </div>
    </div>
  )
}
