'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, User } from 'lucide-react'
import { toast } from 'sonner'

import { moverOportunidade, ganharOportunidade, perderOportunidade } from '@/actions/crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EtapaKanban, OportunidadeCard } from '@/lib/crm/dados'

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const ROTULO_RECEITA: Record<string, string> = {
  mensalidade: 'Mensalidade',
  projeto: 'Projeto',
}

export function CardOportunidade({
  oportunidade,
  etapas,
}: {
  oportunidade: OportunidadeCard
  etapas: EtapaKanban[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function mover(etapaId: string) {
    if (etapaId === oportunidade.etapaId) return
    startTransition(async () => {
      const result = await moverOportunidade(oportunidade.id, etapaId)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel mover a oportunidade.')
        return
      }
      router.refresh()
    })
  }

  function ganhar() {
    // v1 sem modal próprio: confirm() decide se o ganho também cria o cliente
    // na carteira (só faz efeito quando a oportunidade tem empresa vinculada).
    const criarCliente = window.confirm(
      'Oportunidade ganha! Deseja também criar o cliente na carteira da agência?'
    )
    startTransition(async () => {
      const result = await ganharOportunidade(oportunidade.id, { criarCliente })
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel marcar como ganha.')
        return
      }
      toast.success(
        result.data?.clienteId
          ? 'Oportunidade ganha — cliente criado na carteira.'
          : 'Oportunidade ganha.'
      )
      router.refresh()
    })
  }

  function perder() {
    const motivo = window.prompt('Qual o motivo da perda?')
    if (motivo === null) return
    if (!motivo.trim()) {
      toast.error('Informe o motivo da perda.')
      return
    }
    startTransition(async () => {
      const result = await perderOportunidade(oportunidade.id, motivo)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel marcar como perdida.')
        return
      }
      toast.success('Oportunidade marcada como perdida.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{oportunidade.titulo}</p>
        {oportunidade.tipoReceita && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {ROTULO_RECEITA[oportunidade.tipoReceita] ?? oportunidade.tipoReceita}
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {oportunidade.empresaNome && (
          <p className="flex items-center gap-1.5">
            <Building2 className="size-3 shrink-0" />
            {oportunidade.empresaNome}
          </p>
        )}
        {oportunidade.contatoNome && (
          <p className="flex items-center gap-1.5">
            <User className="size-3 shrink-0" />
            {oportunidade.contatoNome}
          </p>
        )}
      </div>

      {oportunidade.valor != null && (
        <p className="text-sm font-semibold tabular-nums">{formatoBRL.format(oportunidade.valor)}</p>
      )}

      <Select value={oportunidade.etapaId} onValueChange={mover} disabled={isPending}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          {etapas.map((etapa) => (
            <SelectItem key={etapa.id} value={etapa.id} className="text-xs">
              {etapa.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs text-emerald-600 hover:text-emerald-700"
          disabled={isPending}
          onClick={ganhar}
        >
          Ganhar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={perder}
        >
          Perder
        </Button>
      </div>
    </div>
  )
}
