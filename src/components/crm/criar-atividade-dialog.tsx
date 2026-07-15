'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { criarAtividadeCrm } from '@/actions/crm-atividades'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea'
import { rotuloServico } from '@/lib/crm/servicos'
import { PRIORIDADES_ATIVIDADE, TIPOS_TAREFA_CRM } from '@/lib/validations/crm'

/** '' (Select "nenhum") vira undefined — mesma filosofia de validations/crm.ts. */
const uuidOpcional = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(''))
  .transform((v) => v || undefined)

// Campos do FORM (o resto — contatoId e dataInicio/dataFim ISO — entra na
// action, que revalida TUDO com o atividadeSchema completo, inclusive fim > inicio).
const schemaForm = z.object({
  titulo: z.string().trim().min(1, 'Informe um titulo para a atividade'),
  tipo: z.enum(TIPOS_TAREFA_CRM).default('followup'),
  prioridade: z
    .enum(PRIORIDADES_ATIVIDADE)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  descricao: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  donoId: uuidOpcional,
  oportunidadeId: uuidOpcional,
})

// Modal "Criar atividade" fiel a cria_atividade.png: titulo, atendente, lead
// fixo + negocio opcional, data/hora inicio-fim com a duracao calculada, tipo,
// prioridade, descricao e o botao azul largo. Persiste em crm_tarefas via
// criarAtividadeCrm (atividadeSchema valida fim > inicio).

const ROTULO_TIPO: Record<(typeof TIPOS_TAREFA_CRM)[number], string> = {
  ligacao: 'Ligacao',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reuniao',
  followup: 'Follow-up',
  outro: 'Outro',
}

const ROTULO_PRIORIDADE: Record<(typeof PRIORIDADES_ATIVIDADE)[number], string> = {
  baixa: 'Baixa',
  media: 'Media',
  alta: 'Alta',
}

/** 'YYYY-MM-DD' de hoje no fuso local (inputs type=date). */
function hojeLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** ISO local a partir de date + time — Date.parse entende 'YYYY-MM-DDTHH:mm'. */
function montarIso(data: string, hora: string): string {
  return data && hora ? `${data}T${hora}` : ''
}

/** Duracao legivel entre inicio e fim ('30m', '1h 15m'); invalida = '—'. */
function duracao(inicioIso: string, fimIso: string): string {
  const ini = Date.parse(inicioIso)
  const fim = Date.parse(fimIso)
  if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) return '—'
  const minutos = Math.round((fim - ini) / 60000)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

type NegocioOpcao = { id: string; servico: string | null; numero: number; status: string }
type Atendente = { id: string; nome: string }

export function CriarAtividadeDialog({
  aberto,
  onOpenChange,
  contatoId,
  contatoNome,
  negocios,
  atendentes,
  donoPadraoId,
  onCriada,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  contatoId: string
  contatoNome: string
  negocios: NegocioOpcao[]
  atendentes: Atendente[]
  // Default do Select de atendente: o usuario logado (quando conhecido).
  donoPadraoId?: string | null
  // Recarrega a ficha apos criar (reusa o carregar() da FichaLead).
  onCriada: () => void
}) {
  const [isPending, startTransition] = useTransition()

  // Data/hora como partes (inputs date+time nativos, como na referencia);
  // o ISO composto vai para o atividadeSchema no submit.
  const [dataInicio, setDataInicio] = useState(hojeLocal)
  const [horaInicio, setHoraInicio] = useState('13:00')
  const [dataFim, setDataFim] = useState(hojeLocal)
  const [horaFim, setHoraFim] = useState('13:30')

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<
    z.input<typeof schemaForm>,
    unknown,
    z.output<typeof schemaForm>
  >({
    resolver: zodResolver(schemaForm),
    defaultValues: {
      titulo: '',
      tipo: 'followup',
      prioridade: '',
      descricao: '',
      donoId: donoPadraoId ?? '',
      oportunidadeId: '',
    },
  })

  const tipo = watch('tipo')
  const prioridade = watch('prioridade')
  const donoId = watch('donoId')
  const oportunidadeId = watch('oportunidadeId')

  const inicioIso = montarIso(dataInicio, horaInicio)
  const fimIso = montarIso(dataFim, horaFim)

  function fechar(abertoNovo: boolean) {
    if (!abertoNovo) {
      reset()
      setDataInicio(hojeLocal())
      setHoraInicio('13:00')
      setDataFim(hojeLocal())
      setHoraFim('13:30')
    }
    onOpenChange(abertoNovo)
  }

  function onSubmit(values: z.output<typeof schemaForm>) {
    startTransition(async () => {
      const result = await criarAtividadeCrm({
        ...values,
        contatoId,
        dataInicio: inicioIso,
        dataFim: fimIso,
      })
      if ('error' in result) {
        toast.error(result.error ?? 'Nao foi possivel criar a atividade.')
        return
      }
      toast.success('Atividade criada.')
      fechar(false)
      onCriada()
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar atividade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="atv-titulo">Titulo</Label>
            <Input
              id="atv-titulo"
              placeholder="Informe um titulo para a atividade"
              {...register('titulo')}
            />
            {formState.errors.titulo && (
              <p className="text-xs text-destructive">{formState.errors.titulo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Atendente</Label>
            <Select
              value={donoId || 'nenhum'}
              onValueChange={(v) => setValue('donoId', v === 'nenhum' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o atendente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem atendente</SelectItem>
                {atendentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead FIXO (a atividade nasce da ficha) + negocio opcional. */}
          <div className="space-y-2">
            <Label>Lead</Label>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {contatoNome}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Negocio</Label>
            <Select
              value={oportunidadeId || 'nenhum'}
              onValueChange={(v) => setValue('oportunidadeId', v === 'nenhum' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um negocio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem negocio</SelectItem>
                {negocios.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    #{n.numero} — {rotuloServico(n.servico)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data/hora inicio-fim com a duracao calculada (como na referencia). */}
          <div className="space-y-2">
            <Label>Data</Label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value)
                      // Fim acompanha o dia do inicio (o caso comum e mesmo dia).
                      if (dataFim < e.target.value) setDataFim(e.target.value)
                    }}
                    aria-label="Data de inicio"
                  />
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-28"
                    aria-label="Hora de inicio"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    aria-label="Data de fim"
                  />
                  <Input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="w-28"
                    aria-label="Hora de fim"
                  />
                </div>
              </div>
              <div className="flex w-16 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">
                {duracao(inicioIso, fimIso)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de atividade</Label>
            <Select
              value={tipo ?? 'followup'}
              onValueChange={(v) => setValue('tipo', v as (typeof TIPOS_TAREFA_CRM)[number])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TAREFA_CRM.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ROTULO_TIPO[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={prioridade || 'nenhuma'}
              onValueChange={(v) => setValue('prioridade', v === 'nenhuma' ? '' : (v as (typeof PRIORIDADES_ATIVIDADE)[number]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem prioridade</SelectItem>
                {PRIORIDADES_ATIVIDADE.map((p) => (
                  <SelectItem key={p} value={p}>
                    {ROTULO_PRIORIDADE[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="atv-descricao">Descricao</Label>
            <Textarea
              id="atv-descricao"
              rows={3}
              placeholder="Informe uma descricao para a atividade"
              {...register('descricao')}
            />
          </div>

          {/* Botao azul largo, como na referencia. */}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Criando...' : 'Criar atividade'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
