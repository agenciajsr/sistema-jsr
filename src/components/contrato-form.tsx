'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { atualizarContrato, registrarContrato } from '@/actions/contratos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'

const valoresPadrao: ContratoInput = {
  dataInicio: '',
  dataVencimento: '',
  valorMensal: 0,
}

const ERRO_PADRAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

type ContratoFormProps = {
  clienteId: string
  // Quando presente, o formulário EDITA o contrato existente (db.update) em vez
  // de registrar um novo. Usado para corrigir dados digitados errado.
  contratoId?: string
  defaultValues?: ContratoInput
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline'
  triggerSize?: 'default' | 'sm'
}

export function ContratoForm({
  clienteId,
  contratoId,
  defaultValues,
  triggerLabel,
  triggerVariant,
  triggerSize,
}: ContratoFormProps) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const modoEdicao = Boolean(contratoId)
  const rotuloBotao = triggerLabel ?? (modoEdicao ? 'Editar' : 'Registrar Contrato')
  const rotuloSalvar = modoEdicao ? 'Salvar alterações' : 'Registrar Contrato'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof contratoSchema>, unknown, ContratoInput>({
    resolver: zodResolver(contratoSchema),
    defaultValues: defaultValues ?? valoresPadrao,
  })

  function onSubmit(values: ContratoInput) {
    startTransition(async () => {
      const result = contratoId
        ? await atualizarContrato(contratoId, values)
        : await registrarContrato(clienteId, values)

      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success(modoEdicao ? 'Contrato atualizado com sucesso.' : 'Contrato registrado com sucesso.')
      if (!modoEdicao) reset(valoresPadrao)
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button
        type="button"
        variant={triggerVariant ?? (modoEdicao ? 'outline' : 'default')}
        size={triggerSize ?? 'default'}
        onClick={() => setAberto(true)}
      >
        {rotuloBotao}
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`dataInicio-${contratoId ?? 'novo'}`}>Data de início</Label>
          <Input id={`dataInicio-${contratoId ?? 'novo'}`} type="date" {...register('dataInicio')} />
          {errors.dataInicio && (
            <p className="text-sm text-destructive">{errors.dataInicio.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`dataVencimento-${contratoId ?? 'novo'}`}>Data de vencimento</Label>
          <Input id={`dataVencimento-${contratoId ?? 'novo'}`} type="date" {...register('dataVencimento')} />
          {errors.dataVencimento && (
            <p className="text-sm text-destructive">{errors.dataVencimento.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`valorMensal-${contratoId ?? 'novo'}`}>Valor mensal</Label>
        <Input
          id={`valorMensal-${contratoId ?? 'novo'}`}
          type="number"
          step="0.01"
          min="0"
          {...register('valorMensal')}
        />
        {errors.valorMensal && (
          <p className="text-sm text-destructive">{errors.valorMensal.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : rotuloSalvar}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            reset(defaultValues ?? valoresPadrao)
            setAberto(false)
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
