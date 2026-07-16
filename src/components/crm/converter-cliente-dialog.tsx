'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Mail, Phone, Trophy, User } from 'lucide-react'
import { toast } from 'sonner'

import { converterOportunidadeEmCliente } from '@/actions/crm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OportunidadeCard } from '@/lib/crm/dados'

// Fase 3 do funil — Ganho → Cliente. Abre DEPOIS do ganho confirmado no
// kanban: converter é uma OFERTA, nunca uma condição ("Agora não" mantém o
// negócio ganho). A action é idempotente — se o lead já virou cliente antes,
// só vincula e avisa "Este lead já é cliente."

/** Formata o telefone só-dígitos para leitura ((62) 99999-0000). */
function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digitos
}

export function ConverterClienteDialog({
  oportunidade,
  onOpenChange,
}: {
  oportunidade: OportunidadeCard | null
  onOpenChange: (aberta: boolean) => void
}) {
  const router = useRouter()
  const [convertendo, startTransition] = useTransition()

  function converter() {
    if (!oportunidade) return
    startTransition(async () => {
      const result = await converterOportunidadeEmCliente(oportunidade.id)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('data' in result && result.data) {
        const { clienteId, jaExistia } = result.data
        toast.success(
          jaExistia ? 'Este lead já é cliente.' : 'Cliente criado — aguardando início.',
          {
            action: {
              label: 'Abrir ficha',
              onClick: () => router.push(`/clientes/${clienteId}`),
            },
          },
        )
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={oportunidade !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-emerald-600 dark:text-emerald-400" />
            Negócio ganho! Converter em cliente?
          </DialogTitle>
          <DialogDescription>
            Cria a ficha do cliente com status <span className="font-medium">Aguardando início</span>,
            reaproveitando nome, telefone, e-mail e empresa do lead. Você pode recusar — o negócio
            continua ganho do mesmo jeito.
          </DialogDescription>
        </DialogHeader>

        {oportunidade && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dados que serão usados
            </p>
            {oportunidade.contatoNome && (
              <p className="flex items-center gap-2">
                <User className="size-3.5 shrink-0 text-muted-foreground" />
                {oportunidade.contatoNome}
              </p>
            )}
            {oportunidade.empresaNome && (
              <p className="flex items-center gap-2">
                <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                {oportunidade.empresaNome}
              </p>
            )}
            {oportunidade.telefoneNormalizado && (
              <p className="flex items-center gap-2 tabular-nums">
                <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                {formatarTelefone(oportunidade.telefoneNormalizado)}
              </p>
            )}
            {!oportunidade.contatoNome && !oportunidade.empresaNome && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                Negócio sem contato vinculado — complete a ficha depois.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={convertendo}
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Button>
          <Button type="button" disabled={convertendo} onClick={converter}>
            {convertendo ? 'Convertendo…' : 'Converter em cliente'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
