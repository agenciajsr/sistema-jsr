'use client'

import { useState, useTransition } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Building2, CheckCircle2, Loader2, User } from 'lucide-react'

import { salvarDadosContratante } from '@/actions/contrato-publico'
import { contratanteSchema, type ContratanteInput } from '@/lib/validations/contratante'
import { formatarCpf, formatarCnpj } from '@/lib/validations/documentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Formulário PÚBLICO e MOBILE-FIRST (o cliente abre no WhatsApp): campos
// grandes, um por linha, botões PJ/PF thumb-friendly. A validação usa o MESMO
// schema Zod da action (contratanteSchema) — aqui só antecipa o feedback.
//
// RHF com tipo FLAT (todos os campos das duas variantes): o discriminated
// union do Zod entra na hora do submit, montando o payload da variante
// escolhida e mapeando os erros de volta via setError.

type FormFlat = {
  tipo: 'pj' | 'pf'
  razaoSocial: string
  cnpj: string
  enderecoSede: string
  nomeRepresentante: string
  enderecoRepresentante: string
  nomeCompleto: string
  endereco: string
  cpf: string
  nacionalidade: string
  estadoCivil: string
  profissao: string
  telefone: string
  email: string
}

const VAZIO: FormFlat = {
  tipo: 'pj',
  razaoSocial: '',
  cnpj: '',
  enderecoSede: '',
  nomeRepresentante: '',
  enderecoRepresentante: '',
  nomeCompleto: '',
  endereco: '',
  cpf: '',
  nacionalidade: 'Brasileira',
  estadoCivil: '',
  profissao: '',
  telefone: '',
  email: '',
}

/** Monta os defaults: dados de reenvio (se houver) > dados do cliente > vazio. */
function montarDefaults(
  preenchido: { nome: string; email: string; telefone: string },
  dadosAnteriores: unknown
): FormFlat {
  const base: FormFlat = {
    ...VAZIO,
    nomeCompleto: preenchido.nome,
    nomeRepresentante: preenchido.nome,
    razaoSocial: '',
    telefone: preenchido.telefone,
    email: preenchido.email,
  }
  if (dadosAnteriores && typeof dadosAnteriores === 'object') {
    const d = dadosAnteriores as Partial<FormFlat>
    return { ...base, ...d, tipo: d.tipo === 'pf' ? 'pf' : 'pj' }
  }
  return base
}

export function FormularioContratante({
  token,
  preenchido,
  dadosAnteriores,
}: {
  token: string
  preenchido: { nome: string; email: string; telefone: string }
  dadosAnteriores: unknown
}) {
  const [enviando, startTransition] = useTransition()
  const [enviado, setEnviado] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const form = useForm<FormFlat>({
    defaultValues: montarDefaults(preenchido, dadosAnteriores),
  })
  const tipo = form.watch('tipo')
  const { errors } = form.formState

  function onSubmit(v: FormFlat) {
    setErroGeral(null)
    form.clearErrors()

    const payload: ContratanteInput =
      v.tipo === 'pj'
        ? {
            tipo: 'pj',
            razaoSocial: v.razaoSocial,
            cnpj: v.cnpj,
            enderecoSede: v.enderecoSede,
            telefone: v.telefone,
            nomeRepresentante: v.nomeRepresentante,
            nacionalidade: v.nacionalidade,
            estadoCivil: v.estadoCivil,
            profissao: v.profissao,
            cpf: v.cpf,
            enderecoRepresentante: v.enderecoRepresentante,
            email: v.email,
          }
        : {
            tipo: 'pf',
            nomeCompleto: v.nomeCompleto,
            cpf: v.cpf,
            nacionalidade: v.nacionalidade,
            estadoCivil: v.estadoCivil,
            profissao: v.profissao,
            endereco: v.endereco,
            telefone: v.telefone,
            email: v.email,
          }

    const parsed = contratanteSchema.safeParse(payload)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0]
        if (typeof campo === 'string') {
          form.setError(campo as Path<FormFlat>, { message: issue.message })
        }
      }
      return
    }

    startTransition(async () => {
      const result = await salvarDadosContratante(token, parsed.data)
      if ('error' in result && result.error) {
        setErroGeral(result.error)
        return
      }
      setEnviado(true)
    })
  }

  if (enviado) {
    return (
      <div className="space-y-3 py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-lg font-semibold">Dados recebidos!</h2>
        <p className="text-sm text-muted-foreground">
          A equipe JSR vai preparar seu contrato e te avisar pelo WhatsApp. Pode fechar esta página.
        </p>
      </div>
    )
  }

  const erroDe = (campo: keyof FormFlat) =>
    errors[campo] ? <p className="text-xs text-destructive">{errors[campo]?.message}</p> : null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Tipo de contratante — botões grandes, thumb-friendly */}
      <div className="space-y-1.5">
        <Label>Quem assina o contrato?</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => form.setValue('tipo', 'pj')}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors',
              tipo === 'pj'
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60'
            )}
          >
            <Building2 className="size-5" />
            Pessoa Jurídica
          </button>
          <button
            type="button"
            onClick={() => form.setValue('tipo', 'pf')}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors',
              tipo === 'pf'
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60'
            )}
          >
            <User className="size-5" />
            Pessoa Física
          </button>
        </div>
      </div>

      {tipo === 'pj' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="razaoSocial">Razão social</Label>
            <Input id="razaoSocial" {...form.register('razaoSocial')} />
            {erroDe('razaoSocial')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              {...form.register('cnpj', {
                onChange: (e) => form.setValue('cnpj', formatarCnpj(e.target.value)),
              })}
            />
            {erroDe('cnpj')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enderecoSede">Endereço da sede</Label>
            <Input id="enderecoSede" {...form.register('enderecoSede')} />
            {erroDe('enderecoSede')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" inputMode="tel" {...form.register('telefone')} />
            {erroDe('telefone')}
          </div>

          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Representante legal
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nomeRepresentante">Nome do representante</Label>
            <Input id="nomeRepresentante" {...form.register('nomeRepresentante')} />
            {erroDe('nomeRepresentante')}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nacionalidade">Nacionalidade</Label>
              <Input id="nacionalidade" {...form.register('nacionalidade')} />
              {erroDe('nacionalidade')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estadoCivil">Estado civil</Label>
              <Input id="estadoCivil" {...form.register('estadoCivil')} />
              {erroDe('estadoCivil')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profissao">Profissão</Label>
            <Input id="profissao" {...form.register('profissao')} />
            {erroDe('profissao')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF do representante</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              {...form.register('cpf', {
                onChange: (e) => form.setValue('cpf', formatarCpf(e.target.value)),
              })}
            />
            {erroDe('cpf')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enderecoRepresentante">Endereço do representante</Label>
            <Input id="enderecoRepresentante" {...form.register('enderecoRepresentante')} />
            {erroDe('enderecoRepresentante')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" inputMode="email" {...form.register('email')} />
            {erroDe('email')}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="nomeCompleto">Nome completo</Label>
            <Input id="nomeCompleto" {...form.register('nomeCompleto')} />
            {erroDe('nomeCompleto')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              {...form.register('cpf', {
                onChange: (e) => form.setValue('cpf', formatarCpf(e.target.value)),
              })}
            />
            {erroDe('cpf')}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nacionalidade">Nacionalidade</Label>
              <Input id="nacionalidade" {...form.register('nacionalidade')} />
              {erroDe('nacionalidade')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estadoCivil">Estado civil</Label>
              <Input id="estadoCivil" {...form.register('estadoCivil')} />
              {erroDe('estadoCivil')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profissao">Profissão</Label>
            <Input id="profissao" {...form.register('profissao')} />
            {erroDe('profissao')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" {...form.register('endereco')} />
            {erroDe('endereco')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" inputMode="tel" {...form.register('telefone')} />
            {erroDe('telefone')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" inputMode="email" {...form.register('email')} />
            {erroDe('email')}
          </div>
        </>
      )}

      {erroGeral && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erroGeral}</p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        {enviando ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          'Enviar dados'
        )}
      </Button>
    </form>
  )
}
