'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { createInvestimentoAquisicao } from '@/actions/financeiro'
import type { InvestimentoAquisicaoRow } from '@/actions/financeiro'
import { CANAIS_AQUISICAO, ROTULO_CANAL, type CanalAquisicao } from '@/lib/financeiro/cac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Competência corrente 'YYYY-MM' (sem depender de fuso — usa a data local). */
function competenciaAtual(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

/** Tela dedicada de lançamento do investimento em aquisição por canal/mês. */
export function AquisicaoForm({ historico }: { historico: InvestimentoAquisicaoRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [competencia, setCompetencia] = useState(competenciaAtual())

  // Valores por canal para a competência selecionada, pré-preenchidos do histórico.
  const valoresDaCompetencia = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const linha of historico) {
      if (linha.competencia === competencia) {
        // Normaliza "1000.00" → "1000" para exibição amigável no input.
        mapa.set(linha.canal, String(Number(linha.valor)))
      }
    }
    return mapa
  }, [historico, competencia])

  const [valores, setValores] = useState<Record<string, string>>({})

  // A cada troca de competência, recarrega os inputs a partir do histórico.
  const [ultimaCompetencia, setUltimaCompetencia] = useState(competencia)
  if (ultimaCompetencia !== competencia) {
    setUltimaCompetencia(competencia)
    const inicial: Record<string, string> = {}
    for (const canal of CANAIS_AQUISICAO) {
      inicial[canal] = valoresDaCompetencia.get(canal) ?? ''
    }
    setValores(inicial)
  }

  function valorDoCanal(canal: CanalAquisicao): string {
    return valores[canal] ?? valoresDaCompetencia.get(canal) ?? ''
  }

  function onSalvar() {
    startTransition(async () => {
      const alvos = CANAIS_AQUISICAO.map((canal) => ({
        canal,
        bruto: valorDoCanal(canal).trim(),
      })).filter((a) => a.bruto !== '')

      if (alvos.length === 0) {
        toast.error('Informe ao menos um valor de investimento.')
        return
      }

      for (const alvo of alvos) {
        const valor = Number(alvo.bruto.replace(',', '.'))
        if (Number.isNaN(valor) || valor < 0) {
          toast.error(`Valor inválido em ${ROTULO_CANAL[alvo.canal]}.`)
          return
        }
        const result = await createInvestimentoAquisicao({
          canal: alvo.canal,
          competencia,
          valor,
        })
        if ('error' in result) {
          toast.error(result.error ?? 'Não foi possível salvar.')
          return
        }
      }

      toast.success('Investimento em aquisição salvo com sucesso.')
      setAberto(false)
      router.refresh()
    })
  }

  // Histórico agrupado por competência (desc) para a tabela.
  const historicoOrdenado = useMemo(
    () => [...historico].sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [historico],
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAberto(true)}>
          <Plus className="mr-2 size-4" />
          Lançar investimento
        </Button>
      </div>

      <Dialog
        open={aberto}
        onOpenChange={(open) => (open ? setAberto(true) : isPending ? undefined : setAberto(false))}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4" />
              Investimento em aquisição
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Lance, por competência e canal, quanto a JSR investiu para captar clientes. Alimenta o CAC
            por canal e a relação LTV/CAC na Visão Analítica.
          </p>

          <div className="space-y-5">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="competencia">Competência</Label>
              <Input
                id="competencia"
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value || competenciaAtual())}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Investimento por canal (R$)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CANAIS_AQUISICAO.map((canal) => (
                  <div key={canal} className="flex items-center gap-3">
                    <Label htmlFor={`canal-${canal}`} className="w-28 shrink-0 text-sm">
                      {ROTULO_CANAL[canal]}
                    </Label>
                    <Input
                      id={`canal-${canal}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={valorDoCanal(canal)}
                      onChange={(e) =>
                        setValores((prev) => ({ ...prev, [canal]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                if (!isPending) setAberto(false)
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={onSalvar} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar lançamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {historicoOrdenado.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum investimento lançado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Competência</th>
                    <th className="py-2 pr-4 font-medium">Canal</th>
                    <th className="py-2 pr-4 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoOrdenado.map((linha) => (
                    <tr key={linha.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 tabular-nums">{linha.competencia}</td>
                      <td className="py-2 pr-4">
                        {ROTULO_CANAL[linha.canal as CanalAquisicao] ?? linha.canal}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatadorMoeda.format(Number(linha.valor))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
