'use client'

// Funil de Conversão configurável (referência: imagens 5-6): 2-6 etapas, métrica
// por etapa, % de conversão entre etapas e custo por unidade. Barras CSS puras
// (sem lib), tons de azul escurecendo. Configuração persistida por cliente.

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LinhaCampanha } from '@/lib/trafego/painel'
import {
  salvarPreferenciasCampanhas,
  type PreferenciaFunil,
} from '@/actions/trafego'

// Métricas disponíveis por etapa do funil (valor extraído dos agregados por campanha).
type MetricaFunilId =
  | 'impressoes'
  | 'cliques'
  | 'cliquesNoLink'
  | 'visualizacoesLp'
  | 'adicoesCarrinho'
  | 'conversas'
  | 'leads'
  | 'compras'
  | 'resultados'

const METRICAS_FUNIL: { id: MetricaFunilId; label: string }[] = [
  { id: 'impressoes', label: 'Impressões' },
  { id: 'cliques', label: 'Cliques' },
  { id: 'cliquesNoLink', label: 'Cliques no link' },
  { id: 'visualizacoesLp', label: 'Visualizações de página de destino' },
  { id: 'adicoesCarrinho', label: 'Adições ao carrinho' },
  { id: 'conversas', label: 'Conversas' },
  { id: 'leads', label: 'Leads' },
  { id: 'compras', label: 'Compras' },
  { id: 'resultados', label: 'Resultados' },
]

const LABEL_FUNIL = new Map(METRICAS_FUNIL.map((m) => [m.id, m.label]))
const IDS_VALIDOS = new Set<string>(METRICAS_FUNIL.map((m) => m.id))

function valorDaMetrica(id: MetricaFunilId, c: LinhaCampanha): number {
  switch (id) {
    case 'impressoes':
      return c.impressions
    case 'cliques':
      return c.clicks
    case 'cliquesNoLink':
      return c.linkClicks
    case 'visualizacoesLp':
      return c.visualizacoesLp
    case 'adicoesCarrinho':
      return c.adicoesCarrinho
    case 'conversas':
      return c.conversas
    case 'leads':
      return c.leads
    case 'compras':
      return c.vendas
    case 'resultados':
      return c.resultadoHeroi
  }
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorNumero = new Intl.NumberFormat('pt-BR')
const formatadorPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

// Tons de azul escurecendo por etapa (como na referência).
const CORES_ETAPA = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a']

const ETAPAS_PADRAO: MetricaFunilId[] = ['impressoes', 'cliques', 'resultados']

type FunilConversaoProps = {
  campanhas: LinhaCampanha[]
  funilSalvo: PreferenciaFunil | null
  clienteId: string
}

export function FunilConversao({ campanhas, funilSalvo, clienteId }: FunilConversaoProps) {
  const [etapas, setEtapas] = useState<MetricaFunilId[]>(() => {
    const salvas = (funilSalvo?.etapas ?? []).filter((e): e is MetricaFunilId => IDS_VALIDOS.has(e))
    return salvas.length >= 2 ? salvas.slice(0, 6) : ETAPAS_PADRAO
  })
  const [selecionadas, setSelecionadas] = useState<Set<string> | null>(() => {
    // null = todas as campanhas
    if (!funilSalvo?.campanhas) return null
    const existentes = new Set(campanhas.map((c) => c.campaignId))
    const validas = funilSalvo.campanhas.filter((id) => existentes.has(id))
    return validas.length > 0 ? new Set(validas) : null
  })
  const [, startTransition] = useTransition()

  // Persistência otimista (mesma degradação graciosa da grade de KPIs).
  function persistir(novasEtapas: MetricaFunilId[], novasSelecionadas: Set<string> | null) {
    startTransition(async () => {
      const res = await salvarPreferenciasCampanhas(clienteId, {
        funil: {
          campanhas: novasSelecionadas ? Array.from(novasSelecionadas) : null,
          etapas: novasEtapas,
        },
      })
      if (res?.error) toast.error(res.error)
    })
  }

  function mudarEtapa(indice: number, id: MetricaFunilId) {
    const novas = etapas.map((e, i) => (i === indice ? id : e))
    setEtapas(novas)
    persistir(novas, selecionadas)
  }

  function adicionarEtapa() {
    if (etapas.length >= 6) return
    const novas = [...etapas, 'resultados' as MetricaFunilId]
    setEtapas(novas)
    persistir(novas, selecionadas)
  }

  function removerEtapa(indice: number) {
    if (etapas.length <= 2) return
    const novas = etapas.filter((_, i) => i !== indice)
    setEtapas(novas)
    persistir(novas, selecionadas)
  }

  function alternarCampanha(id: string, marcada: boolean) {
    const base = selecionadas ?? new Set(campanhas.map((c) => c.campaignId))
    const novo = new Set(base)
    if (marcada) novo.add(id)
    else novo.delete(id)
    if (novo.size === 0) return // pelo menos 1 campanha
    const todas = novo.size === campanhas.length
    const resultado = todas ? null : novo
    setSelecionadas(resultado)
    persistir(etapas, resultado)
  }

  const campanhasAtivas = useMemo(
    () =>
      selecionadas
        ? campanhas.filter((c) => selecionadas.has(c.campaignId))
        : campanhas,
    [campanhas, selecionadas],
  )

  const spendTotal = campanhasAtivas.reduce((s, c) => s + c.spend, 0)

  const valores = useMemo(
    () =>
      etapas.map((id) =>
        campanhasAtivas.reduce((s, c) => s + valorDaMetrica(id, c), 0),
      ),
    [etapas, campanhasAtivas],
  )

  const base = valores[0] ?? 0

  const rotuloSelecao = selecionadas
    ? `${campanhasAtivas.length} ${campanhasAtivas.length === 1 ? 'campanha selecionada' : 'campanhas selecionadas'}`
    : 'Todas as campanhas'

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Funil de Conversão</CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              {rotuloSelecao}
              <ChevronDown className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-72 w-80 overflow-y-auto p-2">
            <div className="space-y-1">
              {campanhas.map((c) => {
                const marcada = selecionadas ? selecionadas.has(c.campaignId) : true
                return (
                  <label
                    key={c.campaignId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(v) => alternarCampanha(c.campaignId, v === true)}
                    />
                    <span className="truncate" title={c.campaignName}>
                      {c.campaignName}
                    </span>
                  </label>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seletores de métrica por etapa */}
        <div className="flex flex-wrap items-end gap-3">
          {etapas.map((id, i) => (
            <div key={`${id}-${i}`} className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Etapa {i + 1}
                </span>
                {etapas.length > 2 && i >= 2 && (
                  <button
                    type="button"
                    onClick={() => removerEtapa(i)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remover etapa ${i + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <Select value={id} onValueChange={(v) => mudarEtapa(i, v as MetricaFunilId)}>
                <SelectTrigger className="w-[210px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICAS_FUNIL.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {etapas.length < 6 && (
            <Button variant="outline" size="sm" onClick={adicionarEtapa}>
              <Plus className="size-4" />
              Adicionar etapa
            </Button>
          )}
        </div>

        {/* Barras do funil */}
        <div className="flex flex-col items-center gap-1 py-2">
          <p className="mb-2 text-xs text-muted-foreground">
            Valor investido no recorte: <span className="font-medium">{formatadorMoeda.format(spendTotal)}</span>
          </p>
          {etapas.map((id, i) => {
            const valor = valores[i]
            const largura = base > 0 ? Math.max((valor / base) * 100, 25) : 25
            const custoUnidade = valor > 0 ? spendTotal / valor : null
            const anterior = i > 0 ? valores[i - 1] : null
            const conversao =
              anterior !== null && anterior > 0 ? (valor / anterior) * 100 : null

            return (
              <div key={`${id}-${i}`} className="flex w-full flex-col items-center">
                {i > 0 && (
                  <span className="py-1 text-xs font-medium text-muted-foreground">
                    {conversao === null ? '—' : `${formatadorPct.format(conversao)}% Conversão`}
                  </span>
                )}
                <div
                  className="flex min-h-16 flex-col items-center justify-center rounded-xl px-4 py-2 text-white shadow-sm transition-all"
                  style={{ width: `${largura}%`, backgroundColor: CORES_ETAPA[i] ?? CORES_ETAPA[5] }}
                >
                  <span className="text-xs font-medium opacity-90">{LABEL_FUNIL.get(id)}</span>
                  <span className="text-xl font-semibold tabular-nums">
                    {formatadorNumero.format(valor)}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {custoUnidade === null ? '—' : formatadorMoeda.format(custoUnidade)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
