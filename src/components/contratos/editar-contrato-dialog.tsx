'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { atualizarDadosContrato, type ContratoConsolidado } from '@/actions/contratos'
import { contratoEdicaoSchema } from '@/lib/validations/contrato'
import { servicosContratadosSchema, somaServicos } from '@/lib/contratos/servicos-contratados'
import {
  ServicosChecklist,
  paraServicosContratados,
  validarChecklist,
  type ItemChecklist,
} from '@/components/contratos/servicos-checklist'
import type { ServicoJsr } from '@/lib/crm/servicos'

// Dialog "Editar" — RHF + Zod (3 generics do zodResolver por causa do
// z.coerce, memória do projeto). Sentinela 'nenhum' porque o SelectItem do
// shadcn não aceita value="".
const NENHUM = 'nenhum'

// quick-260716-ky2: monta o estado do checklist a partir do contrato.
// Estruturado (servicos jsonb) → itens fiéis; legado (null) → pré-popula 1
// item de melhor esforço a partir de servico + valorMensal (plataformas em
// branco — o usuário marca).
function itensDoContrato(contrato: ContratoConsolidado): ItemChecklist[] {
  const parsed = servicosContratadosSchema.safeParse(contrato.servicos)
  if (parsed.success) {
    return parsed.data.map((s) => ({
      servico: s.servico,
      valorStr: String(s.valor).replace('.', ','),
      plataformas: s.plataformas ?? [],
    }))
  }
  if (contrato.servico) {
    return [
      {
        servico: contrato.servico as ServicoJsr,
        valorStr: String(Number(contrato.valorMensal)).replace('.', ','),
        plataformas: [],
      },
    ]
  }
  return []
}

type Entrada = z.input<typeof contratoEdicaoSchema>
type Saida = z.output<typeof contratoEdicaoSchema>

export function EditarContratoDialog({
  aberto,
  onFechar,
  contrato,
}: {
  aberto: boolean
  onFechar: () => void
  contrato: ContratoConsolidado
}) {
  const [salvando, startTransition] = useTransition()

  // Checklist de serviços (quick-260716-ky2). `tocou` preserva a
  // retrocompatibilidade: em contrato legado, se o usuário NÃO mexer nos
  // serviços, nada de novo é gravado (comportamento atual permanece).
  const contratoEstruturado = servicosContratadosSchema.safeParse(contrato.servicos).success
  const [itens, setItens] = useState<ItemChecklist[]>(() => itensDoContrato(contrato))
  const [tocou, setTocou] = useState(false)
  const [erroServicos, setErroServicos] = useState<string | null>(null)
  const usandoServicos = contratoEstruturado || tocou

  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(contratoEdicaoSchema),
    defaultValues: {
      dataInicio: contrato.dataInicio,
      dataVencimento: contrato.dataVencimento,
      valorMensal: contrato.valorMensal,
      servico: (contrato.servico as Entrada['servico']) ?? null,
      duracaoMeses: contrato.duracaoMeses,
      tipoDocumento: contrato.tipoDocumento,
    },
  })

  // Reidrata o form quando abrir para OUTRO contrato.
  useEffect(() => {
    if (aberto) {
      form.reset({
        dataInicio: contrato.dataInicio,
        dataVencimento: contrato.dataVencimento,
        valorMensal: contrato.valorMensal,
        servico: (contrato.servico as Entrada['servico']) ?? null,
        duracaoMeses: contrato.duracaoMeses,
        tipoDocumento: contrato.tipoDocumento,
      })
      setItens(itensDoContrato(contrato))
      setTocou(false)
      setErroServicos(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, contrato.id])

  function onSubmit(values: Saida) {
    let payload = values
    if (usandoServicos) {
      const erro = validarChecklist(itens)
      setErroServicos(erro)
      if (erro) return
      const servicos = paraServicosContratados(itens)
      // O servidor recalcula soma/servico — aqui só espelhamos p/ passar no schema.
      payload = {
        ...values,
        servicos,
        valorMensal: somaServicos(servicos),
        servico: servicos[0].servico,
      }
    }
    startTransition(async () => {
      const resultado = await atualizarDadosContrato(contrato.id, payload)
      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }
      toast.success('Contrato atualizado.')
      onFechar()
    })
  }

  const erros = form.formState.errors

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contrato — {contrato.clienteNome}</DialogTitle>
          <DialogDescription>Corrija datas, valores e classificação do contrato.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataInicio">Início</Label>
              <Input id="dataInicio" type="date" {...form.register('dataInicio')} />
              {erros.dataInicio && (
                <p className="text-xs text-destructive">{erros.dataInicio.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataVencimento">Fim</Label>
              <Input id="dataVencimento" type="date" {...form.register('dataVencimento')} />
              {erros.dataVencimento && (
                <p className="text-xs text-destructive">{erros.dataVencimento.message}</p>
              )}
            </div>
          </div>

          {!usandoServicos && (
            <div className="space-y-1.5">
              <Label htmlFor="valorMensal">Mensalidade (R$)</Label>
              <Input
                id="valorMensal"
                type="number"
                step="0.01"
                min="0"
                {...form.register('valorMensal')}
              />
              {erros.valorMensal && (
                <p className="text-xs text-destructive">{erros.valorMensal.message}</p>
              )}
            </div>
          )}

          <ServicosChecklist
            itens={itens}
            onChange={(novos) => {
              setItens(novos)
              setTocou(true)
              if (erroServicos) setErroServicos(null)
            }}
            erro={erroServicos}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duração</Label>
              <Select
                value={form.watch('duracaoMeses') ? String(form.watch('duracaoMeses')) : NENHUM}
                onValueChange={(v) =>
                  form.setValue('duracaoMeses', v === NENHUM ? null : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Sem duração</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de documento</Label>
            <Select
              value={form.watch('tipoDocumento') ?? NENHUM}
              onValueChange={(v) => form.setValue('tipoDocumento', v === NENHUM ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Contrato (padrão)</SelectItem>
                <SelectItem value="aditivo">Aditivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
