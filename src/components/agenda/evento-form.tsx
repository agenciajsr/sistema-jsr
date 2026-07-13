'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CalendarPlus } from 'lucide-react'

import {
  criarEventoAction,
  editarEventoAction,
  eventoSchema,
  type EventoInput,
} from '@/actions/agenda'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const ERRO_PADRAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

const valoresPadrao: EventoInput = {
  titulo: '',
  descricao: '',
  local: '',
  inicio: '',
  fim: '',
}

type Props = {
  /** Quando presente, o formulário edita o evento em vez de criar. */
  eventId?: string
  defaultValues?: Partial<EventoInput>
  /** Rótulo do botão que abre o formulário (default: "Novo compromisso"). */
  labelAbrir?: string
}

export function EventoForm({ eventId, defaultValues, labelAbrir = 'Novo compromisso' }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventoInput>({
    resolver: zodResolver(eventoSchema),
    defaultValues: { ...valoresPadrao, ...defaultValues },
  })

  function onSubmit(values: EventoInput) {
    startTransition(async () => {
      const result = eventId
        ? await editarEventoAction(eventId, values)
        : await criarEventoAction(values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success(eventId ? 'Compromisso atualizado.' : 'Compromisso criado.')
      if (!eventId) reset(valoresPadrao)
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button type="button" variant={eventId ? 'outline' : 'default'} size="sm" onClick={() => setAberto(true)}>
        {!eventId && <CalendarPlus className="size-4" />}
        {eventId ? 'Editar' : labelAbrir}
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border bg-card p-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor={`titulo-${eventId ?? 'novo'}`}>Título</Label>
        <Input id={`titulo-${eventId ?? 'novo'}`} {...register('titulo')} placeholder="Reunião com cliente" />
        {errors.titulo && <p className="text-sm text-destructive">{errors.titulo.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`inicio-${eventId ?? 'novo'}`}>Início</Label>
          <Input id={`inicio-${eventId ?? 'novo'}`} type="datetime-local" {...register('inicio')} />
          {errors.inicio && <p className="text-sm text-destructive">{errors.inicio.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`fim-${eventId ?? 'novo'}`}>Fim</Label>
          <Input id={`fim-${eventId ?? 'novo'}`} type="datetime-local" {...register('fim')} />
          {errors.fim && <p className="text-sm text-destructive">{errors.fim.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`local-${eventId ?? 'novo'}`}>Local (opcional)</Label>
        <Input id={`local-${eventId ?? 'novo'}`} {...register('local')} placeholder="Google Meet, escritório..." />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`descricao-${eventId ?? 'novo'}`}>Descrição (opcional)</Label>
        <Textarea id={`descricao-${eventId ?? 'novo'}`} {...register('descricao')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : eventId ? 'Salvar alterações' : 'Criar compromisso'}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
