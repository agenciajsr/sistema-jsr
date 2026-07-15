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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TagsSelect } from '@/components/crm/tags-select'
import { mascararTelefone, mascararDocumento } from '@/lib/crm/mascaras'
import { nomeOrigem } from '@/lib/crm/origem'
import { SERVICOS_JSR, SERVICOS_KEYS, type ServicoJsr } from '@/lib/crm/servicos'
import { leadSchema, ORIGENS_LEAD, TIPOS_RECEITA } from '@/lib/validations/crm'
import type { EtapaKanban } from '@/lib/crm/dados'

// A PORTA DE ENTRADA do CRM (D-01): o lead CHEGA (form Meta, WhatsApp,
// indicacao, prospeccao) com nome/telefone/email/origem — nunca com um "titulo"
// de negocio. O titulo e derivado na action (servico + nome).
//
// Layout do quick 260715-gmf (imagens 07-11): Dialog CENTRALIZADO "Criar novo
// Lead" com Nome + Tags no topo, 4 abas (Contato / Dados Pessoais / Endereco /
// Anotacoes) e a secao de Negocio abaixo. Isto SUBSTITUI a decisao antiga de
// Card inline (o usuario decidiu o Dialog central do mockup).

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
    site: '',
    dataNascimento: '',
    pais: 'Brasil',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    notas: '',
    tagIds: [],
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
  const pais = watch('pais') ?? 'Brasil'
  const tagIds = watch('tagIds') ?? []

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

  return (
    <Dialog open={aberto} onOpenChange={(open) => (open ? setAberto(true) : fechar())}>
      <Button type="button" onClick={() => setAberto(true)} disabled={etapas.length === 0}>
        <Plus className="size-4" />
        Novo Lead
      </Button>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar novo Lead</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, (errs) =>
            onInvalid(errs as Record<string, { message?: string } | undefined>)
          )}
          className="space-y-4"
          noValidate
        >
          {/* Topo fixo: Nome + Tags (imagens 07-11) */}
          <div className="space-y-2">
            <Label htmlFor="lead-nome">Nome</Label>
            <Input id="lead-nome" placeholder="Informe o nome do lead" {...register('nome')} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagsSelect
              value={tagIds}
              onChange={(ids) => setValue('tagIds', ids, { shouldValidate: false })}
            />
          </div>

          {/* forceMount + hidden: trocar de aba NAO desmonta os inputs — o
              estado do RHF (register) sobrevive a navegacao entre abas. */}
          <Tabs defaultValue="contato">
            <TabsList className="w-full">
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="pessoais">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
            </TabsList>

            {/* Aba Contato (imagem 07) */}
            <TabsContent value="contato" forceMount className="space-y-4 pt-2 data-[state=inactive]:hidden">
              <div className="space-y-2">
                <Label htmlFor="lead-telefone">Telefone</Label>
                <div className="flex">
                  <span className="flex items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    <span aria-hidden>🇧🇷</span> +55
                  </span>
                  {/* Controlado: a mascara roda ANTES do setValue (nao usar register). */}
                  <Input
                    id="lead-telefone"
                    inputMode="tel"
                    className="rounded-l-none"
                    value={telefone}
                    onChange={(e) =>
                      setValue('telefone', mascararTelefone(e.target.value), {
                        shouldValidate: false,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="Exemplo: meulead@gmail.com"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-site">Site</Label>
                <Input id="lead-site" placeholder="Exemplo: www.meulead.com.br" {...register('site')} />
              </div>
              {/* Sem email E sem telefone nao ha identidade para deduplicar (D-02). */}
              <p className="text-xs text-muted-foreground">
                Informe ao menos o email ou o telefone — e por eles que reconhecemos um
                lead que ja existe.
              </p>
            </TabsContent>

            {/* Aba Dados Pessoais (imagem 09) */}
            <TabsContent value="pessoais" forceMount className="space-y-4 pt-2 data-[state=inactive]:hidden">
              <div className="space-y-2">
                <Label htmlFor="lead-documento">Documento</Label>
                <Input
                  id="lead-documento"
                  inputMode="numeric"
                  placeholder="Informe o CPF ou CNPJ"
                  value={documento}
                  onChange={(e) =>
                    setValue('documento', mascararDocumento(e.target.value), {
                      shouldValidate: false,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-empresa">Empresa</Label>
                <Input
                  id="lead-empresa"
                  placeholder="Informe a empresa do lead"
                  {...register('empresaNome')}
                />
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={origem ?? 'manual'}
                  onValueChange={(v) => setValue('origem', v as (typeof ORIGENS_LEAD)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Como o lead ficou sabendo da sua empresa?" />
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
                <Label htmlFor="lead-nascimento">Data de Nascimento</Label>
                <Input id="lead-nascimento" type="date" {...register('dataNascimento')} />
                {errors.dataNascimento && (
                  <p className="text-sm text-destructive">{errors.dataNascimento.message}</p>
                )}
              </div>
            </TabsContent>

            {/* Aba Endereço (imagem 10) */}
            <TabsContent value="endereco" forceMount className="space-y-4 pt-2 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>País</Label>
                  <Select value={pais} onValueChange={(v) => setValue('pais', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="País" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Brasil">🇧🇷 Brasil</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-cep">CEP</Label>
                  <Input id="lead-cep" placeholder="ex: 12345-678" {...register('cep')} />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-endereco">Endereço</Label>
                  <Input id="lead-endereco" placeholder="ex: Av. Paulista" {...register('endereco')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-numero">Número</Label>
                  <Input id="lead-numero" placeholder="ex: 123" className="w-24" {...register('numero')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-complemento">Complemento</Label>
                  <Input
                    id="lead-complemento"
                    placeholder="ex: Apto 101"
                    className="w-32"
                    {...register('complemento')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-bairro">Bairro</Label>
                  <Input id="lead-bairro" placeholder="ex: Centro" {...register('bairro')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-cidade">Cidade</Label>
                  <Input id="lead-cidade" placeholder="ex: São Paulo" {...register('cidade')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-uf">UF</Label>
                  <Input id="lead-uf" placeholder="ex: SP" maxLength={2} className="w-16" {...register('estado')} />
                </div>
              </div>
            </TabsContent>

            {/* Aba Anotações (imagem 11) */}
            <TabsContent value="anotacoes" forceMount className="space-y-4 pt-2 data-[state=inactive]:hidden">
              <Textarea rows={5} placeholder="Anotações sobre o lead..." {...register('notas')} />
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Seção Negócio: o negócio continua nascendo JUNTO com o lead
              (fluxo lead-first — 1 lead → N negócios). */}
          <p className="text-sm font-medium">Negócio</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={servico} onValueChange={(v) => setValue('servico', v as ServicoJsr)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Serviço de interesse" />
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
            <div className="space-y-2">
              <Label htmlFor="lead-valor">Valor (R$)</Label>
              <Input id="lead-valor" type="number" step="0.01" min="0" {...register('valor')} />
              {errors.valor && <p className="text-sm text-destructive">{errors.valor.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              {errors.etapaId && (
                <p className="text-sm text-destructive">{errors.etapaId.message}</p>
              )}
            </div>
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

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
