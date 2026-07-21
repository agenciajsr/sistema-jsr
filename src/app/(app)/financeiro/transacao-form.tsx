'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { createTransacao, updateTransacao } from '@/actions/financeiro'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { transacaoSchema, type TransacaoInput } from '@/lib/validations/transacao'

import { useTransacoesStore, type TransacaoRow } from './transacoes-store'

type ClienteOption = { id: string; nome: string }
type ResponsavelOption = { id: string; nome: string }

export type TransacaoParaEditar = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  clienteId?: string | null
  descricao: string
  valor: string
  data: string
  status: 'pago' | 'pendente' | 'vencido'
  diaVencto?: number | null
  notas?: string | null
  centroCusto?: string | null
  recorrencia?: string | null
  formaPagamento?: string | null
  responsavelId?: string | null
  comprovanteUrl?: string | null
}

const SELECT_CLASS = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

const CATEGORIAS_RECEITA = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'outro', label: 'Outros serviços' },
]

const CATEGORIAS_DESPESA = [
  { value: 'ferramenta', label: 'Ferramenta' },
  { value: 'ads_agencia', label: 'Ads da agência' },
  { value: 'salario', label: 'Salário' },
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
  centroCusto: '' as const,
  recorrencia: 'avulsa' as const,
  formaPagamento: '' as const,
  responsavelId: '',
  comprovanteUrl: '',
}

const ERRO_PADRAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

// Formulário de transação em Dialog CENTRALIZADO (quick-260719-wwm), no
// padrão visual do NovoLeadDialog do CRM — a página não é mais "empurrada"
// pelo formulário inline. Criação: botão-gatilho abre o dialog. Edição:
// prop `transacao` faz o dialog nascer aberto (comportamento preservado).
export function TransacaoForm({
  clientes,
  responsaveis,
  transacao,
  onClose,
}: {
  clientes: ClienteOption[]
  responsaveis: ResponsavelOption[]
  transacao?: TransacaoParaEditar
  onClose?: () => void
}) {
  const store = useTransacoesStore()
  const [aberto, setAberto] = useState(!!transacao)
  const [isPending, startTransition] = useTransition()

  const isEdicao = !!transacao

  // Monta a linha da tabela a partir dos valores do formulário, resolvendo os
  // nomes de cliente/responsável pelas opções já carregadas — sem ir ao banco.
  function construirLinha(id: string, values: TransacaoInput): TransacaoRow {
    return {
      id,
      tipo: values.tipo,
      categoria: values.categoria,
      clienteId: values.clienteId ?? null,
      clienteNome: clientes.find((c) => c.id === values.clienteId)?.nome ?? null,
      descricao: values.descricao,
      valor: values.valor.toFixed(2),
      data: values.data,
      status: values.status,
      diaVencto: values.diaVencto ?? null,
      notas: values.notas ?? null,
      centroCusto: values.centroCusto ?? null,
      recorrencia: values.recorrencia ?? 'avulsa',
      formaPagamento: values.formaPagamento ?? null,
      responsavelId: values.responsavelId ?? null,
      responsavelNome: responsaveis.find((r) => r.id === values.responsavelId)?.nome ?? null,
      comprovanteUrl: values.comprovanteUrl ?? null,
    }
  }

  const defaultValues = transacao
    ? {
        tipo: transacao.tipo,
        categoria: transacao.categoria as typeof VALORES_PADRAO.categoria,
        clienteId: transacao.clienteId ?? '',
        descricao: transacao.descricao,
        valor: Number(transacao.valor),
        data: transacao.data,
        status: transacao.status,
        diaVencto: transacao.diaVencto ?? ('' as unknown as undefined),
        notas: transacao.notas ?? '',
        centroCusto: (transacao.centroCusto ?? '') as typeof VALORES_PADRAO.centroCusto,
        recorrencia: (transacao.recorrencia ?? 'avulsa') as typeof VALORES_PADRAO.recorrencia,
        formaPagamento: (transacao.formaPagamento ?? '') as typeof VALORES_PADRAO.formaPagamento,
        responsavelId: transacao.responsavelId ?? '',
        comprovanteUrl: transacao.comprovanteUrl ?? '',
      }
    : VALORES_PADRAO

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof transacaoSchema>, unknown, TransacaoInput>({
    resolver: zodResolver(transacaoSchema),
    defaultValues,
  })

  const tipoAtual = watch('tipo')
  const categorias = tipoAtual === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA

  function onSubmit(values: TransacaoInput) {
    startTransition(async () => {
      const result = isEdicao
        ? await updateTransacao(transacao!.id, values)
        : await createTransacao(values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success(
        isEdicao ? 'Transação atualizada com sucesso.' : 'Transação registrada com sucesso.'
      )
      // Reflete a mudança LOCALMENTE em vez de router.refresh() — este
      // recarregava a página inteira (~14 queries render-blocking), o que
      // congelava o /financeiro e deixava conexão zumbi (debug 260721). A
      // mutação já persistiu no banco; KPIs/analítica recalculam no próximo
      // carregamento real (troca de mês, F5). Mesmo padrão do commit 1e84e67.
      const linha = construirLinha(isEdicao ? transacao!.id : result.data.id, values)
      if (isEdicao) {
        store.atualizar(linha)
      } else {
        store.adicionar(linha)
      }
      if (!isEdicao) {
        reset({ ...VALORES_PADRAO, data: hoje() })
      }
      setAberto(false)
      onClose?.()
    })
  }

  function handleCancel() {
    // Submit em andamento não pode ser perdido por um fechamento acidental.
    if (isPending) return
    setAberto(false)
    onClose?.()
  }

  return (
    <>
      {!isEdicao && (
        <Button type="button" onClick={() => setAberto(true)}>
          <Plus className="mr-2 size-4" />
          Adicionar transação
        </Button>
      )}

      <Dialog open={aberto} onOpenChange={(open) => (open ? setAberto(true) : handleCancel())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEdicao && <Pencil className="size-4" />}
              {isEdicao ? 'Editar transação' : 'Nova transação'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  {...register('tipo', {
                    onChange: () => {
                      setValue('categoria', tipoAtual === 'despesa' ? 'mensalidade' : 'ferramenta')
                    },
                  })}
                  className={SELECT_CLASS}
                >
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <select id="categoria" {...register('categoria')} className={SELECT_CLASS}>
                  {categorias.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {errors.categoria && (
                  <p className="text-sm text-destructive">{errors.categoria.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clienteId">Cliente (opcional)</Label>
                <select id="clienteId" {...register('clienteId')} className={SELECT_CLASS}>
                  <option value="">Agência (sem cliente)</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input id="descricao" placeholder="Ex.: Mensalidade cliente X" {...register('descricao')} />
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
                <select id="status" {...register('status')} className={SELECT_CLASS}>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="centroCusto">Centro de custo (opcional)</Label>
                <select id="centroCusto" {...register('centroCusto')} className={SELECT_CLASS}>
                  <option value="">Sem centro de custo</option>
                  <option value="operacao">Operação</option>
                  <option value="midia">Mídia</option>
                  <option value="infraestrutura">Infraestrutura</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recorrencia">Recorrência</Label>
                <select id="recorrencia" {...register('recorrencia')} className={SELECT_CLASS}>
                  <option value="avulsa">Avulsa</option>
                  <option value="semanal">Semanal (toda semana)</option>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="formaPagamento">Forma de pagamento (opcional)</Label>
                <select id="formaPagamento" {...register('formaPagamento')} className={SELECT_CLASS}>
                  <option value="">Não informada</option>
                  <option value="pix">Pix</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responsavelId">Responsável (opcional)</Label>
                <select id="responsavelId" {...register('responsavelId')} className={SELECT_CLASS}>
                  <option value="">Não atribuído</option>
                  {responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comprovanteUrl">URL do comprovante (opcional)</Label>
                <Input
                  id="comprovanteUrl"
                  placeholder="https://..."
                  {...register('comprovanteUrl')}
                />
                {errors.comprovanteUrl && (
                  <p className="text-sm text-destructive">{errors.comprovanteUrl.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <textarea
                id="notas"
                {...register('notas')}
                placeholder="Observações adicionais..."
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleCancel}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : isEdicao ? 'Atualizar transação' : 'Salvar transação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
