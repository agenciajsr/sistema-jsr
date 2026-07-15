'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { criarLead, verificarLeadExistente } from '@/actions/crm-lead'
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
import { mascararTelefone, mascararDocumento } from '@/lib/crm/mascaras'
import { nomeOrigem } from '@/lib/crm/origem'
import { SERVICOS_JSR, SERVICOS_KEYS, type ServicoJsr } from '@/lib/crm/servicos'
import { leadSchema, ORIGENS_LEAD, TIPOS_RECEITA } from '@/lib/validations/crm'
import type { EtapaKanban } from '@/lib/crm/dados'

// A PORTA DE ENTRADA do CRM (D-01): o lead CHEGA (form Meta, WhatsApp,
// indicacao, prospeccao) com nome/telefone/email/origem — nunca com um "titulo"
// de negocio. O titulo e derivado na action (servico + nome).
//
// Mesmo padrao de visibilidade do ContratoForm/NovaOportunidade: useState + Card
// (nao existe dialog.tsx no registry deste projeto).

const ERRO_PADRAO = 'Nao foi possivel salvar. Verifique os dados e tente novamente.'

type LeadExistente = { id: string; nome: string; qtdNegocios: number }

export function NovoLeadDialog({ etapas }: { etapas: EtapaKanban[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Aviso NAO bloqueante: o lead repetido e um caso ESPERADO (a mesma pessoa
  // volta pedindo outro servico) — avisamos e seguimos.
  const [leadExistente, setLeadExistente] = useState<LeadExistente | null>(null)

  const valoresPadrao: z.input<typeof leadSchema> = {
    nome: '',
    empresaNome: '',
    email: '',
    telefone: '',
    documento: '',
    origem: 'manual',
    servico: 'trafego_pago',
    valor: undefined,
    tipoReceita: 'mensalidade',
    etapaId: etapas[0]?.id ?? '',
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof leadSchema>, unknown, z.output<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: valoresPadrao,
  })

  const telefone = watch('telefone') ?? ''
  const documento = watch('documento') ?? ''
  const origem = watch('origem')
  const servico = watch('servico')
  const tipoReceita = watch('tipoReceita')
  const etapaId = watch('etapaId')

  function fechar() {
    reset(valoresPadrao)
    setLeadExistente(null)
    setAberto(false)
  }

  // O refine "email OU telefone" nao pertence a NENHUM campo, entao o zodResolver
  // o entrega sem path — e o RHF nao tem onde pintar de vermelho. Sem isto o
  // botao simplesmente nao faria nada e o usuario ficaria sem explicacao.
  function onInvalid(errs: Record<string, { message?: string } | undefined>) {
    const semPath = errs['']?.message ?? errs.root?.message
    if (semPath) toast.error(semPath)
  }

  function onSubmit(values: z.output<typeof leadSchema>) {
    startTransition(async () => {
      // Checagem LEVE antes de salvar: so para a UI conseguir explicar o que vai
      // acontecer. Quem decide de fato e o dedup dentro do criarLead.
      const previa = await verificarLeadExistente(values.email, values.telefone)
      if ('data' in previa && previa.data?.contato) {
        setLeadExistente(previa.data.contato)
      } else {
        setLeadExistente(null)
      }

      const result = await criarLead(values)
      if ('error' in result) {
        toast.error(result.error ?? ERRO_PADRAO)
        return
      }
      toast.success(
        result.data?.leadExistente
          ? 'Novo negocio aberto para um lead que ja existia.'
          : 'Lead cadastrado.'
      )
      fechar()
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)} disabled={etapas.length === 0}>
        <Plus className="size-4" />
        Novo Lead
      </Button>
    )
  }

  return (
    <Card className="w-full max-w-xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Novo Lead</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit, (errs) =>
            onInvalid(errs as Record<string, { message?: string } | undefined>)
          )}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="lead-nome">Nome</Label>
            <Input id="lead-nome" placeholder="Ex.: Joao Silva" {...register('nome')} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-empresa">Empresa</Label>
            <Input
              id="lead-empresa"
              placeholder="Nome da empresa (opcional)"
              {...register('empresaNome')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" placeholder="joao@empresa.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-telefone">Telefone</Label>
              {/* Controlado: a mascara roda ANTES do setValue (nao usar register). */}
              <Input
                id="lead-telefone"
                inputMode="tel"
                placeholder="(31) 99876-5432"
                value={telefone}
                onChange={(e) =>
                  setValue('telefone', mascararTelefone(e.target.value), { shouldValidate: false })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-documento">CPF / CNPJ</Label>
            <Input
              id="lead-documento"
              inputMode="numeric"
              placeholder="123.456.789-01"
              value={documento}
              onChange={(e) =>
                setValue('documento', mascararDocumento(e.target.value), { shouldValidate: false })
              }
            />
          </div>

          {/* Sem email E sem telefone nao ha identidade para deduplicar (D-02). */}
          <p className="text-xs text-muted-foreground">
            Informe ao menos o email ou o telefone — e por eles que reconhecemos um
            lead que ja existe.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select
                value={origem ?? 'manual'}
                onValueChange={(v) => setValue('origem', v as (typeof ORIGENS_LEAD)[number])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Origem do lead" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS_LEAD.map((o) => (
                    <SelectItem key={o} value={o}>
                      {nomeOrigem(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Servico</Label>
              <Select value={servico} onValueChange={(v) => setValue('servico', v as ServicoJsr)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Servico de interesse" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICOS_KEYS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SERVICOS_JSR[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.servico && (
                <p className="text-sm text-destructive">{errors.servico.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-valor">Valor (R$)</Label>
              <Input id="lead-valor" type="number" step="0.01" min="0" {...register('valor')} />
              {errors.valor && <p className="text-sm text-destructive">{errors.valor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de receita</Label>
              <Select
                value={tipoReceita ?? 'mensalidade'}
                onValueChange={(v) => setValue('tipoReceita', v as (typeof TIPOS_RECEITA)[number])}
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

          {leadExistente && (
            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Esse lead ja existe — vamos abrir um novo negocio para ele.{' '}
                <span className="font-semibold">{leadExistente.nome}</span> ja tem{' '}
                {leadExistente.qtdNegocios}{' '}
                {leadExistente.qtdNegocios === 1 ? 'negocio' : 'negocios'}.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Cadastrar lead'}
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={fechar}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
