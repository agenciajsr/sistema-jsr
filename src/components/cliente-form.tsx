'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { createClienteComContrato, updateCliente } from '@/actions/clientes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { clienteSchema, type ClienteInput } from '@/lib/validations/cliente'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'

const clienteComContratoSchema = z.object({
  cliente: clienteSchema,
  contrato: contratoSchema,
})

// z.input (não z.infer/z.output): clienteSchema.status tem .default('ativo'),
// o que torna o campo opcional no tipo de ENTRADA do form (pré-parse) mas
// obrigatório no tipo de SAÍDA — usar o par input/output evita o erro de tipo
// do zodResolver ao combinar TFieldValues (entrada) com TTransformedValues (saída).
type ClienteComContratoFormValues = z.input<typeof clienteComContratoSchema>
type ClienteComContratoOutput = z.output<typeof clienteComContratoSchema>

const valoresPadraoCliente: ClienteInput = {
  nome: '',
  nicho: 'ecommerce',
  status: 'ativo',
  contatoNome: '',
  contatoTelefone: '',
  contatoEmail: '',
  notas: '',
}

const valoresPadraoContrato: ContratoInput = {
  dataInicio: '',
  dataVencimento: '',
  valorMensal: 0,
}

type ClienteFormProps =
  | { mode: 'criar' }
  | { mode: 'editar'; clienteId: string; defaultValues: ClienteInput }

export function ClienteForm(props: ClienteFormProps) {
  if (props.mode === 'editar') {
    return (
      <ClienteFormEditar
        clienteId={props.clienteId}
        defaultValues={props.defaultValues}
      />
    )
  }
  return <ClienteFormCriar />
}

const ERRO_PADRAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

function ClienteFormCriar() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ClienteComContratoFormValues, unknown, ClienteComContratoOutput>({
    resolver: zodResolver(clienteComContratoSchema),
    defaultValues: { cliente: valoresPadraoCliente, contrato: valoresPadraoContrato },
  })

  function onSubmit(values: ClienteComContratoOutput) {
    startTransition(async () => {
      const result = await createClienteComContrato(values.cliente, values.contrato)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success('Cliente cadastrado com sucesso.')
      router.push('/clientes')
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <div className="space-y-4">
        <h2 className="text-[20px] font-semibold leading-tight">Dados do Cliente</h2>

        <div className="space-y-2">
          <Label htmlFor="cliente.nome">Nome</Label>
          <Input id="cliente.nome" {...register('cliente.nome')} />
          {errors.cliente?.nome && (
            <p className="text-sm text-destructive">{errors.cliente.nome.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cliente.nicho">Nicho</Label>
          <Controller
            name="cliente.nicho"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="cliente.nicho" className="w-full">
                  <SelectValue placeholder="Selecione o nicho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="negocio_local">Negócio Local</SelectItem>
                  <SelectItem value="infoproduto">Infoproduto</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.cliente?.nicho && (
            <p className="text-sm text-destructive">{errors.cliente.nicho.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cliente.status">Status</Label>
          <Controller
            name="cliente.status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="cliente.status" className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.cliente?.status && (
            <p className="text-sm text-destructive">{errors.cliente.status.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cliente.contatoNome">Contato responsável (nome)</Label>
            <Input id="cliente.contatoNome" {...register('cliente.contatoNome')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cliente.contatoTelefone">Contato responsável (telefone)</Label>
            <Input id="cliente.contatoTelefone" {...register('cliente.contatoTelefone')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cliente.contatoEmail">Contato responsável (email)</Label>
          <Input
            id="cliente.contatoEmail"
            type="email"
            {...register('cliente.contatoEmail')}
          />
          {errors.cliente?.contatoEmail && (
            <p className="text-sm text-destructive">
              {errors.cliente.contatoEmail.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cliente.notas">Notas</Label>
          <Textarea id="cliente.notas" {...register('cliente.notas')} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-[20px] font-semibold leading-tight">Primeiro Contrato</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contrato.dataInicio">Data de início</Label>
            <Input
              id="contrato.dataInicio"
              type="date"
              {...register('contrato.dataInicio')}
            />
            {errors.contrato?.dataInicio && (
              <p className="text-sm text-destructive">
                {errors.contrato.dataInicio.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contrato.dataVencimento">Data de vencimento</Label>
            <Input
              id="contrato.dataVencimento"
              type="date"
              {...register('contrato.dataVencimento')}
            />
            {errors.contrato?.dataVencimento && (
              <p className="text-sm text-destructive">
                {errors.contrato.dataVencimento.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contrato.valorMensal">Valor mensal</Label>
          <Input
            id="contrato.valorMensal"
            type="number"
            step="0.01"
            min="0"
            {...register('contrato.valorMensal')}
          />
          {errors.contrato?.valorMensal && (
            <p className="text-sm text-destructive">
              {errors.contrato.valorMensal.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar Cliente'}
      </Button>
    </form>
  )
}

function ClienteFormEditar({
  clienteId,
  defaultValues,
}: {
  clienteId: string
  defaultValues: ClienteInput
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof clienteSchema>, unknown, ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  })

  function onSubmit(values: ClienteInput) {
    startTransition(async () => {
      const result = await updateCliente(clienteId, values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success('Cliente atualizado com sucesso.')
      router.push(`/clientes/${clienteId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" {...register('nome')} />
        {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nicho">Nicho</Label>
        <Controller
          name="nicho"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="nicho" className="w-full">
                <SelectValue placeholder="Selecione o nicho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="negocio_local">Negócio Local</SelectItem>
                <SelectItem value="infoproduto">Infoproduto</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.nicho && <p className="text-sm text-destructive">{errors.nicho.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contatoNome">Contato responsável (nome)</Label>
          <Input id="contatoNome" {...register('contatoNome')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contatoTelefone">Contato responsável (telefone)</Label>
          <Input id="contatoTelefone" {...register('contatoTelefone')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contatoEmail">Contato responsável (email)</Label>
        <Input id="contatoEmail" type="email" {...register('contatoEmail')} />
        {errors.contatoEmail && (
          <p className="text-sm text-destructive">{errors.contatoEmail.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" {...register('notas')} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar Cliente'}
      </Button>
    </form>
  )
}
