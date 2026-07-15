'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { criarOportunidade } from '@/actions/crm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { oportunidadeSchema, type OportunidadeInput } from '@/lib/validations/crm'
import type { EtapaKanban } from '@/lib/crm/dados'

// Mesmo padrão de visibilidade do ContratoForm: useState em vez do Dialog do
// shadcn (fora do registry deste projeto).

const ERRO_PADRAO = 'Nao foi possivel salvar. Verifique os dados e tente novamente.'

export function NovaOportunidadeDialog({ etapas }: { etapas: EtapaKanban[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const valoresPadrao: OportunidadeInput = {
    titulo: '',
    valor: undefined,
    tipoReceita: 'mensalidade',
    etapaId: etapas[0]?.id ?? '',
    contatoNome: '',
    empresaNome: '',
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof oportunidadeSchema>, unknown, z.output<typeof oportunidadeSchema>>({
    resolver: zodResolver(oportunidadeSchema),
    defaultValues: valoresPadrao,
  })

  const etapaId = watch('etapaId')
  const tipoReceita = watch('tipoReceita')

  function onSubmit(values: z.output<typeof oportunidadeSchema>) {
    startTransition(async () => {
      const result = await criarOportunidade(values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success('Oportunidade criada.')
      reset(valoresPadrao)
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)} disabled={etapas.length === 0}>
        <Plus className="size-4" />
        Nova oportunidade
      </Button>
    )
  }

  return (
    <Card className="w-full max-w-xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Nova oportunidade</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="crm-titulo">Título</Label>
            <Input
              id="crm-titulo"
              placeholder="Ex.: Gestão de tráfego — Padaria X"
              {...register('titulo')}
            />
            {errors.titulo && <p className="text-sm text-destructive">{errors.titulo.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crm-valor">Valor (R$)</Label>
              <Input id="crm-valor" type="number" step="0.01" min="0" {...register('valor')} />
              {errors.valor && <p className="text-sm text-destructive">{errors.valor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de receita</Label>
              <Select
                value={tipoReceita ?? 'mensalidade'}
                onValueChange={(v) => setValue('tipoReceita', v as 'mensalidade' | 'projeto')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tipo de receita" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensalidade">Mensalidade</SelectItem>
                  <SelectItem value="projeto">Projeto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crm-contato">Contato</Label>
              <Input id="crm-contato" placeholder="Nome do contato" {...register('contatoNome')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-empresa">Empresa</Label>
              <Input id="crm-empresa" placeholder="Nome da empresa" {...register('empresaNome')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={etapaId} onValueChange={(v) => setValue('etapaId', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha a etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((etapa) => (
                  <SelectItem key={etapa.id} value={etapa.id}>
                    {etapa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.etapaId && <p className="text-sm text-destructive">{errors.etapaId.message}</p>}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Criar oportunidade'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                reset(valoresPadrao)
                setAberto(false)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
