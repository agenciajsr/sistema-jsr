'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { registrarContrato } from '@/actions/contratos'
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

export function ContratoForm({ clienteId }: { clienteId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof contratoSchema>, unknown, ContratoInput>({
    resolver: zodResolver(contratoSchema),
    defaultValues: valoresPadrao,
  })

  function onSubmit(values: ContratoInput) {
    startTransition(async () => {
      const result = await registrarContrato(clienteId, values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success('Contrato registrado com sucesso.')
      reset(valoresPadrao)
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)}>
        Registrar Contrato
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dataInicio">Data de início</Label>
          <Input id="dataInicio" type="date" {...register('dataInicio')} />
          {errors.dataInicio && (
            <p className="text-sm text-destructive">{errors.dataInicio.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataVencimento">Data de vencimento</Label>
          <Input id="dataVencimento" type="date" {...register('dataVencimento')} />
          {errors.dataVencimento && (
            <p className="text-sm text-destructive">{errors.dataVencimento.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="valorMensal">Valor mensal</Label>
        <Input id="valorMensal" type="number" step="0.01" min="0" {...register('valorMensal')} />
        {errors.valorMensal && (
          <p className="text-sm text-destructive">{errors.valorMensal.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Registrando...' : 'Registrar Contrato'}
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
    </form>
  )
}
