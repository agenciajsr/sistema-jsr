'use client'

import { useState, useTransition } from 'react'
import { CreditCard, Wallet, FileText, Landmark } from 'lucide-react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { atualizarFormaPagamentoConta, type FormaPagamentoManual } from '@/actions/trafego'

// Forma de pagamento MANUAL editável por conta. O Meta bloqueia esse dado
// (funding_source_details = Permission Denied #10), então a equipe define à mão.
// Atualização OTIMISTA: reflete a escolha na hora e persiste via server action,
// sem router.refresh() (rollback com toast em caso de erro).

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamentoManual, string> = {
  cartao_credito: 'Cartão de Crédito',
  pix_deposito: 'Pix / Depósito',
  boleto: 'Boleto',
  faturamento: 'Faturamento',
}

const ICONE: Record<FormaPagamentoManual, React.ComponentType<{ className?: string }>> = {
  cartao_credito: CreditCard,
  pix_deposito: Wallet,
  boleto: FileText,
  faturamento: Landmark,
}

const OPCOES = Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamentoManual[]

export function FormaPagamentoSelect({
  adAccountId,
  valorInicial,
}: {
  adAccountId: string
  valorInicial: FormaPagamentoManual | null
}) {
  const [valor, setValor] = useState<FormaPagamentoManual | null>(valorInicial)
  const [isPending, startTransition] = useTransition()

  function onChange(novo: FormaPagamentoManual) {
    const anterior = valor
    setValor(novo) // otimista
    startTransition(async () => {
      const r = await atualizarFormaPagamentoConta(adAccountId, novo)
      if ('error' in r && r.error) {
        setValor(anterior) // rollback
        toast.error(r.error)
        return
      }
      toast.success('Forma de pagamento atualizada.')
    })
  }

  const Icone = valor ? ICONE[valor] : Wallet

  return (
    <Select value={valor ?? ''} onValueChange={(v) => onChange(v as FormaPagamentoManual)} disabled={isPending}>
      <SelectTrigger className="h-8 w-[190px] text-sm" aria-label="Forma de pagamento da conta">
        <span className="flex items-center gap-1.5">
          <Icone className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="Definir…" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {OPCOES.map((op) => {
          const OpIcon = ICONE[op]
          return (
            <SelectItem key={op} value={op}>
              <span className="flex items-center gap-2">
                <OpIcon className="size-3.5 text-muted-foreground" />
                {FORMA_PAGAMENTO_LABEL[op]}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
