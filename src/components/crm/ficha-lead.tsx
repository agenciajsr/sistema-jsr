'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { atualizarLead, getFichaLead } from '@/actions/crm-lead'
import { Badge } from '@/components/ui/badge'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { mascararDocumento, mascararTelefone } from '@/lib/crm/mascaras'
import { nomeOrigem } from '@/lib/crm/origem'
import { rotuloServico } from '@/lib/crm/servicos'
import { tempoRelativoCurto } from '@/lib/crm/tempo'
import { leadPerfilSchema, ORIGENS_LEAD } from '@/lib/validations/crm'

// Ficha do LEAD (nao do negocio): um lead tem N negocios (D-02), entao a ficha
// e a pessoa — Perfil (editavel), Negocios (todos dela) e Historico.
//
// Escopo desta entrega: leitura + edicao do perfil. Anexos, produtos, metricas
// e jornada visual NAO entram — nem como placeholder falso.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Ficha = NonNullable<Awaited<ReturnType<typeof getFichaLead>>['data']>

const ROTULO_ATIVIDADE: Record<string, string> = {
  criacao: 'Negocio criado',
  contato_criado: 'Lead cadastrado',
  mudanca_etapa: 'Mudou de etapa',
  ganho: 'Negocio ganho',
  perda: 'Negocio perdido',
  reabertura: 'Negocio reaberto',
  lead_recebido: 'Lead recebido',
  tarefa_criada: 'Tarefa criada',
  tarefa_concluida: 'Tarefa concluida',
}

function BadgeStatus({ status }: { status: string }) {
  if (status === 'ganha') {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Ganho
      </Badge>
    )
  }
  if (status === 'perdida') {
    return (
      <Badge className="border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        Perdido
      </Badge>
    )
  }
  return <Badge variant="secondary">Aberta</Badge>
}

export function FichaLead({
  contatoId,
  onOpenChange,
}: {
  contatoId: string | null // null = fechada
  onOpenChange: (aberta: boolean) => void
}) {
  const router = useRouter()
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, reset, setValue, watch } = useForm<
    z.input<typeof leadPerfilSchema>,
    unknown,
    z.output<typeof leadPerfilSchema>
  >({
    resolver: zodResolver(leadPerfilSchema),
  })

  const carregar = useCallback(
    async (id: string) => {
      setCarregando(true)
      setErro(null)
      const result = await getFichaLead(id)
      if ('error' in result) {
        setErro(result.error ?? 'Nao foi possivel carregar a ficha do lead.')
        setFicha(null)
      } else if (result.data) {
        setFicha(result.data)
        const p = result.data.perfil
        // Inputs controlados nao aceitam null: '' e o vazio do form.
        reset({
          nome: p.nome,
          email: p.email ?? '',
          telefone: p.telefone ?? '',
          documento: p.documento ?? '',
          site: p.site ?? '',
          cargo: p.cargo ?? '',
          dataNascimento: p.dataNascimento ?? '',
          cep: p.cep ?? '',
          endereco: p.endereco ?? '',
          cidade: p.cidade ?? '',
          estado: p.estado ?? '',
          notas: p.notas ?? '',
          origem: (p.origem as (typeof ORIGENS_LEAD)[number]) ?? 'manual',
        })
      }
      setCarregando(false)
    },
    [reset]
  )

  useEffect(() => {
    // contatoId null = fechada: nao carrega nada.
    if (!contatoId) return
    void carregar(contatoId)
  }, [contatoId, carregar])

  const telefone = watch('telefone') ?? ''
  const documento = watch('documento') ?? ''
  const origem = watch('origem')

  function onSubmit(values: z.output<typeof leadPerfilSchema>) {
    if (!contatoId) return
    startTransition(async () => {
      const result = await atualizarLead(contatoId, values)
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel salvar o lead.')
        return
      }
      toast.success('Lead atualizado.')
      router.refresh()
    })
  }

  return (
    <Sheet open={contatoId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{ficha?.perfil.nome ?? 'Ficha do lead'}</SheetTitle>
          <SheetDescription>
            {ficha?.perfil.empresaNome ?? 'Lead sem empresa vinculada'}
          </SheetDescription>
        </SheetHeader>

        {carregando && (
          <div className="space-y-3 px-4 pb-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!carregando && erro && (
          <p className="px-4 pb-4 text-sm text-destructive">{erro}</p>
        )}

        {!carregando && !erro && ficha && (
          <Tabs defaultValue="perfil" className="px-4 pb-6">
            <TabsList className="w-full">
              <TabsTrigger value="perfil">Perfil</TabsTrigger>
              <TabsTrigger value="negocios">Negocios ({ficha.negocios.length})</TabsTrigger>
              <TabsTrigger value="historico">Historico</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="mt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="ficha-nome">Nome</Label>
                  <Input id="ficha-nome" {...register('nome')} />
                </div>

                <div className="space-y-2">
                  <Label>Empresa</Label>
                  {/* Somente leitura por ora: trocar a empresa do lead exige um
                      seletor de empresas que nao entra nesta entrega. */}
                  <Input value={ficha.perfil.empresaNome ?? 'Sem empresa'} readOnly disabled />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ficha-email">Email</Label>
                    <Input id="ficha-email" type="email" {...register('email')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ficha-telefone">Telefone</Label>
                    <Input
                      id="ficha-telefone"
                      inputMode="tel"
                      value={telefone}
                      onChange={(e) => setValue('telefone', mascararTelefone(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ficha-documento">CPF / CNPJ</Label>
                    <Input
                      id="ficha-documento"
                      inputMode="numeric"
                      value={documento}
                      onChange={(e) => setValue('documento', mascararDocumento(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ficha-site">Site</Label>
                    <Input id="ficha-site" {...register('site')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ficha-nascimento">Nascimento</Label>
                    <Input id="ficha-nascimento" type="date" {...register('dataNascimento')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ficha-cep">CEP</Label>
                    <Input id="ficha-cep" {...register('cep')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ficha-endereco">Endereco</Label>
                  <Input id="ficha-endereco" {...register('endereco')} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ficha-cidade">Cidade</Label>
                    <Input id="ficha-cidade" {...register('cidade')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ficha-estado">Estado</Label>
                    <Input id="ficha-estado" {...register('estado')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select
                    value={origem ?? 'manual'}
                    onValueChange={(v) => setValue('origem', v as (typeof ORIGENS_LEAD)[number])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Origem" />
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
                  <Label htmlFor="ficha-notas">Notas</Label>
                  <Textarea id="ficha-notas" rows={3} {...register('notas')} />
                </div>

                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Salvando...' : 'Salvar perfil'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="negocios" className="mt-4 space-y-2">
              {ficha.negocios.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Esse lead ainda nao tem negocios.
                </p>
              ) : (
                ficha.negocios.map((n) => (
                  <div key={n.id} className="space-y-1.5 rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{rotuloServico(n.servico)}</p>
                      <BadgeStatus status={n.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{n.etapaNome ?? 'Sem etapa'}</span>
                      <span className="tabular-nums">
                        {n.valor != null ? formatoBRL.format(n.valor) : '—'}
                      </span>
                    </div>
                    {n.status === 'perdida' && n.motivoPerda && (
                      <p className="text-xs text-muted-foreground">Motivo: {n.motivoPerda}</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-4 space-y-2">
              {ficha.historico.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Sem historico registrado.
                </p>
              ) : (
                ficha.historico.map((h) => (
                  <div key={h.id} className="flex items-start justify-between gap-3 border-b pb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {ROTULO_ATIVIDADE[h.tipo] ?? h.tipo}
                        {h.de && h.para && (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            — {h.de} para {h.para}
                          </span>
                        )}
                      </p>
                      {h.detalhe && (
                        <p className="truncate text-xs text-muted-foreground">{h.detalhe}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{h.autorNome}</p>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {tempoRelativoCurto(h.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
