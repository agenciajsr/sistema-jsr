'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { vincularContaAoCliente } from '@/actions/trafego'

type Conta = {
  id: string
  nome: string
  metaAccountId: string
  accountStatus: number | null
}

type Cliente = { id: string; nome: string }

export function ContasNaoVinculadas({
  contas,
  clientes,
}: {
  contas: Conta[]
  clientes: Cliente[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // A secao so aparece quando ha contas soltas.
  if (contas.length === 0) return null

  function handleVincular(contaId: string, clienteId: string) {
    startTransition(async () => {
      const result = await vincularContaAoCliente(contaId, clienteId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Conta vinculada.')
      router.refresh()
    })
  }

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-muted-foreground" />
          Contas não vinculadas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Atribua cada conta de anúncio a um cliente para vê-la nos painéis de performance.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {contas.map((conta) => (
          <div
            key={conta.id}
            className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{conta.nome}</p>
              <p className="text-xs text-muted-foreground">act_{conta.metaAccountId}</p>
            </div>
            <Select
              disabled={isPending}
              onValueChange={(clienteId) => handleVincular(conta.id, clienteId)}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Vincular a um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Nenhum cliente ativo
                  </SelectItem>
                ) : (
                  clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
