'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { createTransacao } from '@/actions/financeiro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { transacaoSchema, type TransacaoInput } from '@/lib/validations/transacao'

type ClienteOption = { id: string; nome: string }

const CATEGORIAS_RECEITA = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'outro', label: 'Outro' },
]

const CATEGORIAS_DESPESA = [
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'ads_agencia', label: 'Ads Agencia' },
  { value: 'salario', label: 'Salario' },
  { value: 'outro', label: 'Outro' },
]

const hoje = () => new Date().toISOString().slice(0, 10)

const VALORES_PADRAO = {
  tipo: 'receita' as const,
  categoria: 'mensalidade' as const,
  clienteId: '',
  descricao: '',
  valor: 0,
  data: hoje(),
  status: 'pendente' as const,
  diaVencto: '' as unknown as undefined,
  notas: '',
}

const ERRO_PADRAO = 'Nao foi possivel salvar. Verifique os dados e tente novamente.'

export function TransacaoForm({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof transacaoSchema>, unknown, TransacaoInput>({
    resolver: zodResolver(transacaoSchema),
    defaultValues: VALORES_PADRAO,
  })

  const tipoAtual = watch('tipo')
  const categorias = tipoAtual === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA

  function onSubmit(values: TransacaoInput) {
    startTransition(async () => {
      const result = await createTransacao(values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success('Transacao registrada com sucesso.')
      reset({ ...VALORES_PADRAO, data: hoje() })
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)}>
        <Plus className="mr-2 size-4" />
        Adicionar Transacao
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-border bg-card p-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <select
            id="tipo"
            {...register('tipo', {
              onChange: () => {
                // Reset categoria ao trocar tipo
                setValue('categoria', tipoAtual === 'despesa' ? 'mensalidade' : 'ferramenta')
              },
            })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <select
            id="categoria"
            {...register('categoria')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {categorias.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.categoria && (
            <p className="text-sm text-destructive">{errors.categoria.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="clienteId">Cliente (opcional)</Label>
          <select
            id="clienteId"
            {...register('clienteId')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Agencia (sem cliente)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="descricao">Descricao</Label>
          <Input id="descricao" placeholder="Ex: Mensalidade cliente X" {...register('descricao')} />
          {errors.descricao && (
            <p className="text-sm text-destructive">{errors.descricao.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="valor">Valor (R$)</Label>
          <Input id="valor" type="number" step="0.01" min="0" placeholder="0,00" {...register('valor')} />
          {errors.valor && (
            <p className="text-sm text-destructive">{errors.valor.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="data">Data</Label>
          <Input id="data" type="date" {...register('data')} />
          {errors.data && (
            <p className="text-sm text-destructive">{errors.data.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            {...register('status')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="diaVencto">Dia de vencimento (opcional)</Label>
          <Input id="diaVencto" type="number" min="1" max="31" placeholder="1-31" {...register('diaVencto')} />
          {errors.diaVencto && (
            <p className="text-sm text-destructive">{errors.diaVencto.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas (opcional)</Label>
        <textarea
          id="notas"
          {...register('notas')}
          placeholder="Observacoes adicionais..."
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar Transacao'}
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
