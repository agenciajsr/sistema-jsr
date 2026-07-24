'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'

import { createClienteComContrato, updateCliente, getProfiles, deleteCliente } from '@/actions/clientes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { clienteSchema, SERVICOS_DISPONIVEIS, type ClienteInput } from '@/lib/validations/cliente'
import { mascararCEP, mascararDocumento, somenteDigitos } from '@/lib/validations/documento'
import { contratoSchema, type ContratoInput } from '@/lib/validations/contrato'

const clienteComContratoSchema = z.object({
  cliente: clienteSchema,
  contrato: contratoSchema,
})

type ClienteComContratoFormValues = z.input<typeof clienteComContratoSchema>
type ClienteComContratoOutput = z.output<typeof clienteComContratoSchema>

const SERVICO_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  site: 'Site / Landing Page',
  criativos: 'Criativos',
  social_media: 'Social Media',
  consultoria: 'Consultoria',
  gestao_trafego: 'Gestão de Tráfego',
  landing_page: 'Landing Page',
  crm_estruturacao: 'CRM / Estruturação',
}

const ESTADOS_BR = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
]

const valoresPadraoCliente: z.input<typeof clienteSchema> = {
  nome: '',
  nicho: 'ecommerce',
  segmento: '',
  principalServico: '',
  tagsTexto: '',
  pastas: [],
  status: 'ativo',
  interno: false,
  contatoNome: '',
  contatoTelefone: '',
  contatoEmail: '',
  tipoPessoa: 'juridica',
  documento: '',
  razaoSocial: '',
  nomeFantasia: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  instagram: '',
  siteUrl: '',
  formaPagamento: undefined,
  diaPagamento: '',
  servicosContratados: [],
  gestorId: '',
  verbaMensal: '',
  ticketMedio: '',
  agendamentoPosts: false,
  frequenciaPosts: '',
  notas: '',
  origemCliente: '',
  objetivoPrincipal: '',
  linkDrive: '',
}

const valoresPadraoContrato: ContratoInput = {
  dataInicio: '',
  dataVencimento: '',
  valorMensal: 0,
}

type ProfileOption = { id: string; nome: string }

type ClienteFormProps =
  | { mode: 'criar' }
  | {
      mode: 'editar'
      clienteId: string
      defaultValues: z.input<typeof clienteSchema>
      isAdmin?: boolean
    }

export function ClienteForm(props: ClienteFormProps) {
  if (props.mode === 'editar') {
    return (
      <ClienteFormEditar
        clienteId={props.clienteId}
        defaultValues={props.defaultValues}
        isAdmin={props.isAdmin ?? false}
      />
    )
  }
  return <ClienteFormCriar />
}

const ERRO_PADRAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

// CEP completo → endereço via ViaCEP (grátis, sem chave). Falha silenciosa:
// se a API não responder, o usuário simplesmente preenche na mão.
async function buscarEnderecoPorCep(
  cep: string,
): Promise<{ endereco: string; cidade: string; estado: string } | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (!r.ok) return null
    const j = (await r.json()) as {
      erro?: boolean
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
    }
    if (j.erro) return null
    return {
      endereco: [j.logradouro, j.bairro].filter(Boolean).join(', '),
      cidade: j.localidade ?? '',
      estado: j.uf ?? '',
    }
  } catch {
    return null
  }
}

// Máscara de telefone BR enquanto digita: (11) 99999-9999 / (11) 9999-9999.
function formatarTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Zona de perigo: excluir cliente (admin-only, D-03). Confirmação FORTE — exige
// digitar o nome exato do cliente. A ideia do sistema é inativar (status), não
// deletar; por isso a exclusão vive escondida aqui, longe da ficha.
function ZonaDePerigo({ clienteId, clienteNome }: { clienteId: string; clienteNome: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmacao, setConfirmacao] = useState('')
  const podeExcluir = confirmacao.trim() === clienteNome.trim() && clienteNome.trim() !== ''

  function excluir() {
    startTransition(async () => {
      const result = await deleteCliente(clienteId)
      if ('error' in result) {
        toast.error(result.error ?? 'Não foi possível excluir o cliente.')
        return
      }
      toast.success('Cliente excluído.')
      router.push('/clientes')
    })
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Zona de perigo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Excluir remove o cliente e todo o histórico permanentemente. O normal é{' '}
          <strong>inativar</strong> (mude o Status para Encerrado). Só exclua se for realmente
          necessário.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              <Trash2 className="size-4" />
              Excluir cliente
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente permanentemente</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O cliente e todo o histórico de contratos
                vinculados serão removidos. Para confirmar, digite o nome do cliente:{' '}
                <strong>{clienteNome}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={clienteNome}
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmacao('')}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                disabled={!podeExcluir || isPending}
                onClick={excluir}
              >
                {isPending ? 'Excluindo...' : 'Excluir definitivamente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function ClienteFormCriar() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [profilesList, setProfilesList] = useState<ProfileOption[]>([])

  useEffect(() => {
    getProfiles().then(setProfilesList)
  }, [])

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClienteComContratoFormValues, unknown, ClienteComContratoOutput>({
    resolver: zodResolver(clienteComContratoSchema),
    defaultValues: { cliente: valoresPadraoCliente, contrato: valoresPadraoContrato },
  })

  const tipoPessoa = watch('cliente.tipoPessoa')
  const agendamento = watch('cliente.agendamentoPosts')

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Seção 1 — Dados do Cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente.nome">Nome *</Label>
            <Input id="cliente.nome" {...register('cliente.nome')} />
            {errors.cliente?.nome && (
              <p className="text-sm text-destructive">{errors.cliente.nome.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.tipoPessoa">Tipo de Pessoa</Label>
              <Controller
                name="cliente.tipoPessoa"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cliente.tipoPessoa" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisica">Pessoa Física</SelectItem>
                      <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.documento">{tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
              <Input
                id="cliente.documento"
                placeholder={tipoPessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                {...register('cliente.documento')}
                onChange={(e) =>
                  setValue(
                    'cliente.documento',
                    mascararDocumento(tipoPessoa === 'fisica' ? 'fisica' : 'juridica', e.target.value),
                  )
                }
              />
              {errors.cliente?.documento && (
                <p className="text-sm text-destructive">{errors.cliente.documento.message}</p>
              )}
            </div>
          </div>

          {tipoPessoa === 'juridica' && (
            <div className="space-y-2">
              <Label htmlFor="cliente.razaoSocial">Razão Social</Label>
              <Input id="cliente.razaoSocial" {...register('cliente.razaoSocial')} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cliente.nomeFantasia">Nome Fantasia</Label>
            <Input id="cliente.nomeFantasia" {...register('cliente.nomeFantasia')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.nicho">Nicho *</Label>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.segmento">Segmento</Label>
              <Input
                id="cliente.segmento"
                placeholder="Ex: Clínica de Estética"
                {...register('cliente.segmento')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.principalServico">Principal serviço</Label>
              <Input
                id="cliente.principalServico"
                placeholder="Ex: Emagrecimento"
                {...register('cliente.principalServico')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.tagsTexto">Tags</Label>
            <Input
              id="cliente.tagsTexto"
              placeholder="Ex: Estética, Laser, Alto potencial (separadas por vírgula)"
              {...register('cliente.tagsTexto')}
            />
          </div>

          {/* Perfil interno (agência) — some das métricas de negócio, aparece no tráfego */}
          <Controller
            name="cliente.interno"
            control={control}
            render={({ field }) => (
              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-dashed p-3">
                <Checkbox
                  className="mt-0.5"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
                <span className="text-sm">
                  Cliente interno (a própria agência)
                  <span className="block text-xs text-muted-foreground">
                    Use para a conta de anúncio da agência. Aparece no Tráfego/Campanhas, mas fica fora das métricas de negócio (contagem de clientes, MRR, CAC).
                  </span>
                </span>
              </label>
            )}
          />
        </CardContent>
      </Card>

      {/* Seção 2 — Contato */}
      <Card>
        <CardHeader>
          <CardTitle>Contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.contatoNome">Nome do contato</Label>
              <Input id="cliente.contatoNome" {...register('cliente.contatoNome')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.contatoTelefone">Telefone</Label>
              <Input
                id="cliente.contatoTelefone"
                placeholder="(11) 99999-9999"
                {...register('cliente.contatoTelefone')}
                onChange={(e) =>
                  setValue('cliente.contatoTelefone', formatarTelefone(e.target.value))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.contatoEmail">Email</Label>
            <Input id="cliente.contatoEmail" type="email" {...register('cliente.contatoEmail')} />
            {errors.cliente?.contatoEmail && (
              <p className="text-sm text-destructive">{errors.cliente.contatoEmail.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.instagram">Instagram</Label>
              <Input id="cliente.instagram" placeholder="@perfil" {...register('cliente.instagram')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.siteUrl">Site</Label>
              <Input id="cliente.siteUrl" placeholder="https://..." {...register('cliente.siteUrl')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente.cep">CEP</Label>
            <Input
              id="cliente.cep"
              placeholder="00000-000"
              {...register('cliente.cep')}
              onChange={async (e) => {
                const mascarado = mascararCEP(e.target.value)
                setValue('cliente.cep', mascarado)
                const digitos = somenteDigitos(mascarado)
                if (digitos.length === 8) {
                  const end = await buscarEnderecoPorCep(digitos)
                  if (end) {
                    if (end.endereco) setValue('cliente.endereco', end.endereco)
                    if (end.cidade) setValue('cliente.cidade', end.cidade)
                    if (end.estado) setValue('cliente.estado', end.estado)
                  }
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Digite o CEP completo e o endereço preenche sozinho.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.endereco">Endereço</Label>
            <Input id="cliente.endereco" {...register('cliente.endereco')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.cidade">Cidade</Label>
              <Input id="cliente.cidade" {...register('cliente.cidade')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.estado">Estado</Label>
              <Controller
                name="cliente.estado"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger id="cliente.estado" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf.value} value={uf.value}>{uf.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Primeiro Contrato */}
      <Card>
        <CardHeader>
          <CardTitle>Primeiro Contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contrato.dataInicio">Data de início</Label>
              <Input id="contrato.dataInicio" type="date" {...register('contrato.dataInicio')} />
              {errors.contrato?.dataInicio && (
                <p className="text-sm text-destructive">{errors.contrato.dataInicio.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrato.dataVencimento">Data de vencimento</Label>
              <Input id="contrato.dataVencimento" type="date" {...register('contrato.dataVencimento')} />
              {errors.contrato?.dataVencimento && (
                <p className="text-sm text-destructive">{errors.contrato.dataVencimento.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato.valorMensal">Valor mensal (R$)</Label>
            <Input id="contrato.valorMensal" type="number" step="0.01" min="0" {...register('contrato.valorMensal')} />
            {errors.contrato?.valorMensal && (
              <p className="text-sm text-destructive">{errors.contrato.valorMensal.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.formaPagamento">Forma de pagamento</Label>
              <Controller
                name="cliente.formaPagamento"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || undefined)}>
                    <SelectTrigger id="cliente.formaPagamento" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.diaPagamento">Dia do pagamento</Label>
              <Input id="cliente.diaPagamento" type="number" min="1" max="31" {...register('cliente.diaPagamento')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 5 — Serviços Contratados */}
      <Card>
        <CardHeader>
          <CardTitle>Serviços Contratados</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="cliente.servicosContratados"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SERVICOS_DISPONIVEIS.map((servico) => {
                  const checked = (field.value ?? []).includes(servico)
                  return (
                    <label
                      key={servico}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(isChecked) => {
                          const current = field.value ?? []
                          if (isChecked) {
                            field.onChange([...current, servico])
                          } else {
                            field.onChange(current.filter((s: string) => s !== servico))
                          }
                        }}
                      />
                      <span className="text-sm">{SERVICO_LABELS[servico] ?? servico}</span>
                    </label>
                  )
                })}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Seção 6 — Operação */}
      <Card>
        <CardHeader>
          <CardTitle>Operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente.gestorId">Gestor responsável</Label>
            <Controller
              name="cliente.gestorId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || '')}>
                  <SelectTrigger id="cliente.gestorId" className="w-full">
                    <SelectValue placeholder="Sem gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem gestor</SelectItem>
                    {profilesList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente.verbaMensal">Verba mensal de mídia (R$)</Label>
              <Input id="cliente.verbaMensal" type="number" step="0.01" min="0" {...register('cliente.verbaMensal')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente.ticketMedio">Ticket médio (R$)</Label>
              <Input id="cliente.ticketMedio" type="number" step="0.01" min="0" {...register('cliente.ticketMedio')} />
            </div>
          </div>

          <div className="space-y-4">
            <Controller
              name="cliente.agendamentoPosts"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                  <span className="text-sm">Agendamento de posts</span>
                </label>
              )}
            />

            {agendamento && (
              <div className="space-y-2">
                <Label htmlFor="cliente.frequenciaPosts">Frequência de posts</Label>
                <Input id="cliente.frequenciaPosts" placeholder="Ex: 3x por semana" {...register('cliente.frequenciaPosts')} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção 7 — Observações */}
      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente.origemCliente">Como conheceu a agência?</Label>
            <Input id="cliente.origemCliente" {...register('cliente.origemCliente')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.objetivoPrincipal">Objetivo principal</Label>
            <Textarea id="cliente.objetivoPrincipal" {...register('cliente.objetivoPrincipal')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.linkDrive">Pasta do Google Drive</Label>
            <Input id="cliente.linkDrive" placeholder="https://drive.google.com/drive/folders/..." {...register('cliente.linkDrive')} />
            {errors.cliente?.linkDrive && (
              <p className="text-sm text-destructive">{errors.cliente.linkDrive.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente.notas">Notas internas</Label>
            <Textarea id="cliente.notas" {...register('cliente.notas')} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Salvando...' : 'Salvar Cliente'}
      </Button>
    </form>
  )
}

function ClienteFormEditar({
  clienteId,
  defaultValues,
  isAdmin,
}: {
  clienteId: string
  defaultValues: z.input<typeof clienteSchema>
  isAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [profilesList, setProfilesList] = useState<ProfileOption[]>([])

  useEffect(() => {
    getProfiles().then(setProfilesList)
  }, [])

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof clienteSchema>, unknown, ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  })

  const {
    fields: pastasFields,
    append: appendPasta,
    remove: removePasta,
  } = useFieldArray({ control, name: 'pastas' })

  const tipoPessoa = watch('tipoPessoa')
  const agendamento = watch('agendamentoPosts')
  const statusAtual = watch('status')

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Seção 1 — Dados do Cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register('nome')} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipoPessoa">Tipo de Pessoa</Label>
              <Controller
                name="tipoPessoa"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="tipoPessoa" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisica">Pessoa Física</SelectItem>
                      <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">{tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
              <Input
                id="documento"
                placeholder={tipoPessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                {...register('documento')}
                onChange={(e) =>
                  setValue(
                    'documento',
                    mascararDocumento(tipoPessoa === 'fisica' ? 'fisica' : 'juridica', e.target.value),
                  )
                }
              />
              {errors.documento && (
                <p className="text-sm text-destructive">{errors.documento.message}</p>
              )}
            </div>
          </div>

          {tipoPessoa === 'juridica' && (
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão Social</Label>
              <Input id="razaoSocial" {...register('razaoSocial')} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
            <Input id="nomeFantasia" {...register('nomeFantasia')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nicho">Nicho *</Label>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento</Label>
              <Input
                id="segmento"
                placeholder="Ex: Clínica de Estética"
                {...register('segmento')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="principalServico">Principal serviço</Label>
              <Input
                id="principalServico"
                placeholder="Ex: Emagrecimento"
                {...register('principalServico')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagsTexto">Tags</Label>
            <Input
              id="tagsTexto"
              placeholder="Ex: Estética, Laser, Alto potencial (separadas por vírgula)"
              {...register('tagsTexto')}
            />
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
                    <SelectItem value="aguardando_inicio">Aguardando Início</SelectItem>
                    <SelectItem value="em_aviso">Em Aviso</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Perfil interno (agência) — some das métricas de negócio, aparece no tráfego */}
          <Controller
            name="interno"
            control={control}
            render={({ field }) => (
              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-dashed p-3">
                <Checkbox
                  className="mt-0.5"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
                <span className="text-sm">
                  Cliente interno (a própria agência)
                  <span className="block text-xs text-muted-foreground">
                    Use para a conta de anúncio da agência. Aparece no Tráfego/Campanhas, mas fica fora das métricas de negócio (contagem de clientes, MRR, CAC).
                  </span>
                </span>
              </label>
            )}
          />

          {/* Encerrar é decisão séria: exige o MOTIVO documentado no cliente
              (aparece na ficha; alimenta o aprendizado de churn). */}
          {statusAtual === 'encerrado' && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Label htmlFor="motivoEncerramento">Motivo do encerramento *</Label>
              <Textarea
                id="motivoEncerramento"
                {...register('motivoEncerramento')}
                placeholder="Ex.: corte de orçamento, insatisfação com resultados, fechou a empresa…"
              />
              {errors.motivoEncerramento && (
                <p className="text-sm text-destructive">{errors.motivoEncerramento.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 2 — Contato */}
      <Card>
        <CardHeader>
          <CardTitle>Contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contatoNome">Nome do contato</Label>
              <Input id="contatoNome" {...register('contatoNome')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contatoTelefone">Telefone</Label>
              <Input
                id="contatoTelefone"
                placeholder="(11) 99999-9999"
                {...register('contatoTelefone')}
                onChange={(e) => setValue('contatoTelefone', formatarTelefone(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contatoEmail">Email</Label>
            <Input id="contatoEmail" type="email" {...register('contatoEmail')} />
            {errors.contatoEmail && (
              <p className="text-sm text-destructive">{errors.contatoEmail.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" placeholder="@perfil" {...register('instagram')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteUrl">Site</Label>
              <Input id="siteUrl" placeholder="https://..." {...register('siteUrl')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              placeholder="00000-000"
              {...register('cep')}
              onChange={async (e) => {
                const mascarado = mascararCEP(e.target.value)
                setValue('cep', mascarado)
                const digitos = somenteDigitos(mascarado)
                if (digitos.length === 8) {
                  const end = await buscarEnderecoPorCep(digitos)
                  if (end) {
                    if (end.endereco) setValue('endereco', end.endereco)
                    if (end.cidade) setValue('cidade', end.cidade)
                    if (end.estado) setValue('estado', end.estado)
                  }
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Digite o CEP completo e o endereço preenche sozinho.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" {...register('endereco')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register('cidade')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Controller
                name="estado"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger id="estado" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf.value} value={uf.value}>{uf.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Pagamento (sem contrato no modo editar) */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="formaPagamento">Forma de pagamento</Label>
              <Controller
                name="formaPagamento"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || undefined)}>
                    <SelectTrigger id="formaPagamento" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diaPagamento">Dia do pagamento</Label>
              <Input id="diaPagamento" type="number" min="1" max="31" {...register('diaPagamento')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 5 — Serviços Contratados */}
      <Card>
        <CardHeader>
          <CardTitle>Serviços Contratados</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="servicosContratados"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SERVICOS_DISPONIVEIS.map((servico) => {
                  const checked = (field.value ?? []).includes(servico)
                  return (
                    <label
                      key={servico}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(isChecked) => {
                          const current = field.value ?? []
                          if (isChecked) {
                            field.onChange([...current, servico])
                          } else {
                            field.onChange(current.filter((s: string) => s !== servico))
                          }
                        }}
                      />
                      <span className="text-sm">{SERVICO_LABELS[servico] ?? servico}</span>
                    </label>
                  )
                })}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Seção 6 — Operação */}
      <Card>
        <CardHeader>
          <CardTitle>Operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gestorId">Gestor responsável</Label>
            <Controller
              name="gestorId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || '')}>
                  <SelectTrigger id="gestorId" className="w-full">
                    <SelectValue placeholder="Sem gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem gestor</SelectItem>
                    {profilesList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="verbaMensal">Verba mensal de mídia (R$)</Label>
              <Input id="verbaMensal" type="number" step="0.01" min="0" {...register('verbaMensal')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticketMedio">Ticket médio (R$)</Label>
              <Input id="ticketMedio" type="number" step="0.01" min="0" {...register('ticketMedio')} />
            </div>
          </div>

          <div className="space-y-4">
            <Controller
              name="agendamentoPosts"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                  <span className="text-sm">Agendamento de posts</span>
                </label>
              )}
            />

            {agendamento && (
              <div className="space-y-2">
                <Label htmlFor="frequenciaPosts">Frequência de posts</Label>
                <Input id="frequenciaPosts" placeholder="Ex: 3x por semana" {...register('frequenciaPosts')} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção 7 — Observações */}
      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="origemCliente">Como conheceu a agência?</Label>
            <Input id="origemCliente" {...register('origemCliente')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetivoPrincipal">Objetivo principal</Label>
            <Textarea id="objetivoPrincipal" {...register('objetivoPrincipal')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkDrive">Pasta do Google Drive (principal)</Label>
            <Input id="linkDrive" placeholder="https://drive.google.com/drive/folders/..." {...register('linkDrive')} />
            {errors.linkDrive && (
              <p className="text-sm text-destructive">{errors.linkDrive.message}</p>
            )}
          </div>

          {/* Pastas extras nomeadas (Criativos, Relatórios…) — aparecem no card
              "Pastas e documentos" da ficha com link direto. */}
          <div className="space-y-2">
            <Label>Outras pastas do Drive</Label>
            <div className="space-y-2">
              {pastasFields.map((f, i) => (
                <div key={f.id} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="sm:w-1/3"
                    placeholder="Nome (ex: Criativos)"
                    {...register(`pastas.${i}.nome`)}
                  />
                  <Input
                    className="flex-1"
                    placeholder="https://drive.google.com/..."
                    {...register(`pastas.${i}.url`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => removePasta(i)}
                    aria-label="Remover pasta"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {errors.pastas && (
                <p className="text-sm text-destructive">
                  Confira o nome e o link de cada pasta.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendPasta({ nome: '', url: '' })}
              >
                <Plus className="size-4" />
                Adicionar pasta
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas internas</Label>
            <Textarea id="notas" {...register('notas')} />
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <ZonaDePerigo clienteId={clienteId} clienteNome={String(defaultValues.nome ?? '')} />
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Salvando...' : 'Salvar Cliente'}
      </Button>
    </form>
  )
}
