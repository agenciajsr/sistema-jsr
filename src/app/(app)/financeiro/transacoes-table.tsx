'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, FileCheck, FileX } from 'lucide-react'
import { toast } from 'sonner'

import { deleteTransacao } from '@/actions/financeiro'
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

import { TransacaoForm, type TransacaoParaEditar } from './transacao-form'

type ClienteOption = { id: string; nome: string }
type ResponsavelOption = { id: string; nome: string }

type Transacao = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  clienteId?: string | null
  clienteNome: string | null
  descricao: string
  valor: string
  data: string
  status: 'pago' | 'pendente' | 'vencido'
  diaVencto?: number | null
  notas?: string | null
  centroCusto?: string | null
  recorrencia?: string | null
  formaPagamento?: string | null
  responsavelId?: string | null
  responsavelNome?: string | null
  comprovanteUrl?: string | null
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pago: 'default',
  pendente: 'secondary',
  vencido: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  vencido: 'Vencido',
}

const CATEGORIA_LABEL: Record<string, string> = {
  mensalidade: 'Mensalidade',
  projeto: 'Projeto',
  outro: 'Outro',
  ferramenta: 'Ferramenta',
  ads_agencia: 'Ads Agencia',
  salario: 'Salario',
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

export function TransacoesTable({
  transacoes,
  clientes,
  responsaveis,
}: {
  transacoes: Transacao[]
  clientes: ClienteOption[]
  responsaveis: ResponsavelOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = useState<TransacaoParaEditar | null>(null)

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransacao(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Transacao excluida.')
      router.refresh()
    })
  }

  function handleEdit(t: Transacao) {
    setEditando({
      id: t.id,
      tipo: t.tipo,
      categoria: t.categoria,
      clienteId: t.clienteId,
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
      comprovanteUrl: t.comprovanteUrl,
    })
  }

  if (editando) {
    return (
      <TransacaoForm
        clientes={clientes}
        responsaveis={responsaveis}
        transacao={editando}
        onClose={() => setEditando(null)}
      />
    )
  }

  if (transacoes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma transacao registrada neste mes.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descricao</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Centro de Custo</TableHead>
          <TableHead>Forma Pgto</TableHead>
          <TableHead>Responsavel</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Comprovante</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transacoes.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="tabular-nums">{formatarData(t.data)}</TableCell>
            <TableCell className="font-medium">{t.descricao}</TableCell>
            <TableCell>{t.clienteNome ?? 'Agencia'}</TableCell>
            <TableCell>
              <Badge variant="outline">{CATEGORIA_LABEL[t.categoria] ?? t.categoria}</Badge>
            </TableCell>
            <TableCell>{t.centroCusto ? CENTRO_CUSTO_LABEL[t.centroCusto] ?? t.centroCusto : '-'}</TableCell>
            <TableCell>{t.formaPagamento ? FORMA_PGTO_LABEL[t.formaPagamento] ?? t.formaPagamento : '-'}</TableCell>
            <TableCell>{t.responsavelNome ?? '-'}</TableCell>
            <TableCell
              className={`text-right tabular-nums font-medium ${
                t.tipo === 'receita' ? 'text-chart-success' : 'text-destructive'
              }`}
            >
              {t.tipo === 'despesa' ? '- ' : ''}
              {formatadorMoeda.format(Number(t.valor))}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[t.status] ?? 'secondary'}>
                {STATUS_LABEL[t.status] ?? t.status}
              </Badge>
            </TableCell>
            <TableCell>
              {t.comprovanteUrl ? (
                <a href={t.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-chart-success hover:text-chart-success/80">
                  <FileCheck className="size-4" />
                </a>
              ) : (
                <FileX className="size-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-primary"
                  disabled={isPending}
                  onClick={() => handleEdit(t)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
