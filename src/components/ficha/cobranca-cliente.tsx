'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { createCobranca, updateTransacaoStatus } from '@/actions/financeiro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type StatusCobranca = 'pago' | 'pendente' | 'vencido'

type Cobranca = {
  id: string
  descricao: string
  valor: string
  data: string
  status: StatusCobranca
  diaVencto: number | null
}

const STATUS_COBRANCA: Record<StatusCobranca, { label: string; className: string }> = {
  pago: { label: 'Pago', className: 'bg-chart-success/15 text-chart-success' },
  pendente: { label: 'Pendente', className: 'bg-chart-warning/15 text-chart-warning' },
  vencido: { label: 'Vencido', className: 'bg-destructive/15 text-destructive' },
}

const STATUS_OPCOES: StatusCobranca[] = ['pago', 'pendente', 'vencido']

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const hoje = () => new Date().toISOString().slice(0, 10)

export function CobrancaCliente({
  clienteId,
  modoCobranca,
  cobrancas,
}: {
  clienteId: string
  modoCobranca: string
  cobrancas: Cobranca[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje())
  const [diaVencto, setDiaVencto] = useState('')

  function handleStatus(id: string, status: StatusCobranca) {
    startTransition(async () => {
      const result = await updateTransacaoStatus(id, clienteId, status)
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleCreate() {
    const valorNum = Number(valor.replace(',', '.'))
    if (!descricao.trim()) {
      toast.error('Informe a descrição da cobrança.')
      return
    }
    if (!(valorNum > 0)) {
      toast.error('O valor deve ser maior que zero.')
      return
    }
    startTransition(async () => {
      const result = await createCobranca(clienteId, {
        descricao: descricao.trim(),
        valor: valorNum,
        data,
        diaVencto: diaVencto ? Number(diaVencto) : undefined,
      })
      if (result && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Cobrança adicionada.')
      setDescricao('')
      setValor('')
      setData(hoje())
      setDiaVencto('')
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <span className="text-sm font-medium">Modo de cobrança:</span>
          <Badge
            variant="secondary"
            className={
              modoCobranca === 'automatico_asaas'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'
            }
          >
            {modoCobranca === 'automatico_asaas' ? 'Asaas' : 'Manual PIX'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Para alterar, use a aba Faturas.
          </span>
        </CardContent>
      </Card>

      {cobrancas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>
      ) : (
        <ul className="space-y-2">
          {cobrancas.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{c.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {formatadorMoeda.format(Number(c.valor))} · {formatarData(c.data)}
                  {c.diaVencto ? ` · vence dia ${c.diaVencto}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={STATUS_COBRANCA[c.status].className}>
                  {STATUS_COBRANCA[c.status].label}
                </Badge>
                <select
                  value={c.status}
                  disabled={isPending}
                  onChange={(e) => handleStatus(c.id, e.target.value as StatusCobranca)}
                  className="flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {STATUS_OPCOES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_COBRANCA[s].label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}

      {aberto ? (
        <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cob-descricao">Descrição</Label>
              <Input
                id="cob-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Mensalidade de julho"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cob-valor">Valor (R$)</Label>
              <Input
                id="cob-valor"
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cob-data">Data</Label>
              <Input
                id="cob-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cob-dia">Dia de vencimento (opcional)</Label>
              <Input
                id="cob-dia"
                type="number"
                min="1"
                max="31"
                value={diaVencto}
                onChange={(e) => setDiaVencto(e.target.value)}
                placeholder="1-31"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar cobrança'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAberto(true)}>
          <Plus className="mr-2 size-4" />
          Adicionar cobrança
        </Button>
      )}
    </div>
  )
}
