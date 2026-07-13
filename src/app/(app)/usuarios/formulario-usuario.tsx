'use client'

import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { criarUsuario } from '@/actions/usuarios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usuarioSchema, type UsuarioInput } from '@/lib/validations/usuario'

const valoresPadrao: UsuarioInput = {
  nome: '',
  email: '',
  senhaTemporaria: '',
  role: 'membro',
}

export function FormularioUsuario({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UsuarioInput>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: valoresPadrao,
  })

  function onSubmit(values: UsuarioInput) {
    startTransition(async () => {
      const result = await criarUsuario(values)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Usuário ${result.data.email} criado com sucesso.`)
      reset(valoresPadrao)
      onSuccess?.()
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" autoComplete="name" {...register('nome')} />
        {errors.nome && (
          <p className="text-sm text-destructive">{errors.nome.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="senhaTemporaria">Senha temporária</Label>
        <Input
          id="senhaTemporaria"
          type="password"
          autoComplete="new-password"
          {...register('senhaTemporaria')}
        />
        {errors.senhaTemporaria && (
          <p className="text-sm text-destructive">
            {errors.senhaTemporaria.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Papel</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="membro">Membro</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.role && (
          <p className="text-sm text-destructive">{errors.role.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Adicionando...' : 'Adicionar Usuário'}
      </Button>
    </form>
  )
}
