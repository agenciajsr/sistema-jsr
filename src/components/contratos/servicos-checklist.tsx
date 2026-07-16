'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SERVICOS_KEYS, type ServicoJsr } from '@/lib/crm/servicos'
import {
  PLATAFORMAS_KEYS,
  PLATAFORMAS_TRAFEGO,
  rotuloServicoUi,
  somaServicos,
  servicosContratadosSchema,
  type PlataformaTrafego,
  type ServicoContratado,
} from '@/lib/contratos/servicos-contratados'

// Checklist de serviços contratados — compartilhado entre a conversão
// Ganho→Cliente (converter-cliente-dialog) e a edição de contrato
// (editar-contrato-dialog). Cada serviço marcado revela o input de valor
// mensal; "Tráfego Pago" revela ainda os checkboxes de plataforma.

/** Estado de UI de um serviço marcado (valor como string digitável). */
export type ItemChecklist = {
  servico: ServicoJsr
  valorStr: string
  plataformas: PlataformaTrafego[]
}

/** Converte o estado da UI para o formato validável/gravável. */
export function paraServicosContratados(itens: ItemChecklist[]): ServicoContratado[] {
  return itens.map((item) => ({
    servico: item.servico,
    valor: Number(item.valorStr.replace(',', '.')),
    ...(item.servico === 'trafego_pago' ? { plataformas: item.plataformas } : {}),
  }))
}

/** Valida o estado da UI; retorna a 1ª mensagem de erro pt-BR ou null. */
export function validarChecklist(itens: ItemChecklist[]): string | null {
  const parsed = servicosContratadosSchema.safeParse(paraServicosContratados(itens))
  if (parsed.success) return null
  return parsed.error.issues[0]?.message ?? 'Verifique os serviços marcados.'
}

const formatadorBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Total (soma) formatado em BRL a partir do estado da UI; '—' se inválido. */
export function totalFormatado(itens: ItemChecklist[]): string {
  const valores = paraServicosContratados(itens)
  if (valores.some((v) => !Number.isFinite(v.valor) || v.valor <= 0)) return '—'
  return formatadorBrl.format(somaServicos(valores))
}

export function ServicosChecklist({
  itens,
  onChange,
  erro,
}: {
  itens: ItemChecklist[]
  onChange: (itens: ItemChecklist[]) => void
  erro?: string | null
}) {
  function alternarServico(servico: ServicoJsr) {
    const existente = itens.find((i) => i.servico === servico)
    if (existente) {
      onChange(itens.filter((i) => i.servico !== servico))
    } else {
      // Mantém a ordem canônica de SERVICOS_KEYS na lista enviada.
      const novos = [...itens, { servico, valorStr: '', plataformas: [] as PlataformaTrafego[] }]
      novos.sort((a, b) => SERVICOS_KEYS.indexOf(a.servico) - SERVICOS_KEYS.indexOf(b.servico))
      onChange(novos)
    }
  }

  function mudarValor(servico: ServicoJsr, valorStr: string) {
    onChange(itens.map((i) => (i.servico === servico ? { ...i, valorStr } : i)))
  }

  function alternarPlataforma(servico: ServicoJsr, plataforma: PlataformaTrafego) {
    onChange(
      itens.map((i) => {
        if (i.servico !== servico) return i
        const marcada = i.plataformas.includes(plataforma)
        return {
          ...i,
          plataformas: marcada
            ? i.plataformas.filter((p) => p !== plataforma)
            : [...i.plataformas, plataforma],
        }
      })
    )
  }

  return (
    <div className="space-y-2">
      <Label>Serviços contratados</Label>
      <div className="space-y-1.5 rounded-lg border p-3">
        {SERVICOS_KEYS.map((servico) => {
          const item = itens.find((i) => i.servico === servico)
          const marcado = Boolean(item)
          return (
            <div key={servico} className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={marcado}
                  onCheckedChange={() => alternarServico(servico)}
                  aria-label={rotuloServicoUi(servico)}
                />
                {rotuloServicoUi(servico)}
              </label>

              {item && (
                <div className="ml-6 space-y-2 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <Input
                      inputMode="decimal"
                      placeholder="1500,00"
                      className="h-8 max-w-36"
                      value={item.valorStr}
                      onChange={(e) => mudarValor(servico, e.target.value)}
                      aria-label={`Valor mensal de ${rotuloServicoUi(servico)}`}
                    />
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </div>

                  {servico === 'trafego_pago' && (
                    <div className="flex flex-wrap items-center gap-4">
                      {PLATAFORMAS_KEYS.map((plataforma) => (
                        <label
                          key={plataforma}
                          className="flex cursor-pointer items-center gap-2 text-xs"
                        >
                          <Checkbox
                            checked={item.plataformas.includes(plataforma)}
                            onCheckedChange={() => alternarPlataforma(servico, plataforma)}
                            aria-label={PLATAFORMAS_TRAFEGO[plataforma]}
                          />
                          {PLATAFORMAS_TRAFEGO[plataforma]}
                        </label>
                      ))}
                      <span className="text-[11px] text-muted-foreground">
                        (mínimo 1 plataforma)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm dark:bg-muted/20">
        <span className="text-muted-foreground">Mensalidade total (soma)</span>
        <span className="font-semibold tabular-nums">{totalFormatado(itens)}</span>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
