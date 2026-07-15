'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  Layers,
  Loader2,
  MessageSquareText,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  criarRelatorioConfig,
  atualizarRelatorioConfig,
  listarContasComCampanhas,
  previewRelatorio,
  type ContaComCampanhas,
  type RelatorioConfigDraft,
  type RelatorioConfigResumo,
} from '@/actions/relatorio-configs'
import {
  CATALOGO_VARIAVEIS,
  LABELS_CATEGORIA,
  montarMensagemDeMetricas,
  type CategoriaVariavel,
} from '@/lib/relatorios/variaveis'
import { TEMPLATES_GALERIA } from '@/lib/relatorios/templates-galeria'

const DIAS_SEMANA = [
  { valor: 1, label: 'Segunda-feira' },
  { valor: 2, label: 'Terça-feira' },
  { valor: 3, label: 'Quarta-feira' },
  { valor: 4, label: 'Quinta-feira' },
  { valor: 5, label: 'Sexta-feira' },
  { valor: 6, label: 'Sábado' },
  { valor: 0, label: 'Domingo' },
]

const CATEGORIAS_METRICAS: CategoriaVariavel[] = [
  'investimento', 'cliques', 'leads', 'conversas', 'vendas', 'pagina',
]

const CABECALHO_PADRAO =
  '📊 *Relatório – {{cliente}}*\n📅 Período: {{date_range}}\n🚀 Agência: JSR Tráfego\nBom dia! Segue o resumo do período 👇'

type BlocoDraft = {
  adAccountId: string
  nivel: 'conta' | 'campanhas'
  campanhasSelecionadas: string[]
  metricas: string[]
  mensagem: string
}

function blocoVazio(): BlocoDraft {
  return { adAccountId: '', nivel: 'conta', campanhasSelecionadas: [], metricas: [], mensagem: '' }
}

/** Chips de variáveis clicáveis, agrupadas por categoria, que inserem {{chave}} no textarea alvo. */
function ChipsVariaveis({
  categorias,
  onInserir,
}: {
  categorias: CategoriaVariavel[]
  onInserir: (chave: string) => void
}) {
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
      {categorias.map((cat) => {
        const vars = CATALOGO_VARIAVEIS.filter((v) => v.categoria === cat)
        if (vars.length === 0) return null
        return (
          <div key={cat} className="flex flex-wrap items-center gap-1">
            <span className="mr-1 w-20 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {LABELS_CATEGORIA[cat]}
            </span>
            {vars.map((v) => (
              <button
                key={v.chave}
                type="button"
                title={v.label}
                onClick={() => onInserir(v.chave)}
                className="rounded-full border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {`{{${v.chave}}}`}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientes: { id: string; nome: string }[]
  configParaEditar: RelatorioConfigResumo | null
  onSaved: () => void
}

export function NovoRelatorioDialog({ open, onOpenChange, clientes, configParaEditar, onSaved }: Props) {
  const editando = configParaEditar !== null

  const [etapa, setEtapa] = useState<'config' | 'blocos' | 'mensagens'>('config')

  // Dados gerais
  const [nome, setNome] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [frequencia, setFrequencia] = useState<'semanal' | 'mensal'>('semanal')
  const [diaSemana, setDiaSemana] = useState(1)
  const [diaMes, setDiaMes] = useState(1)
  const [periodoDias, setPeriodoDias] = useState<string>('')
  const [horarioEnvio, setHorarioEnvio] = useState('')
  const [destinoTipo, setDestinoTipo] = useState<'privado' | 'grupo'>('privado')
  const [destinoValor, setDestinoValor] = useState('')

  // Conteúdo
  const [cabecalho, setCabecalho] = useState(CABECALHO_PADRAO)
  const [blocos, setBlocos] = useState<BlocoDraft[]>([blocoVazio()])
  const [incluirCompilado, setIncluirCompilado] = useState(true)
  const [mensagemCompilado, setMensagemCompilado] = useState('')

  // Contas/campanhas do cliente selecionado
  const [contas, setContas] = useState<ContaComCampanhas[]>([])
  const [carregandoContas, setCarregandoContas] = useState(false)
  const [buscaCampanhas, setBuscaCampanhas] = useState('')

  // Preview
  const [preview, setPreview] = useState<string | null>(null)
  const [avisosPreview, setAvisosPreview] = useState<string[]>([])
  const [gerandoPreview, setGerandoPreview] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Refs dos textareas para inserção de variáveis na posição do cursor
  const cabecalhoRef = useRef<HTMLTextAreaElement>(null)
  const compiladoRef = useRef<HTMLTextAreaElement>(null)
  const blocoRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  // (Re)carregar estado ao abrir
  useEffect(() => {
    if (!open) return
    setEtapa('config')
    setBuscaCampanhas('')
    if (configParaEditar) {
      setNome(configParaEditar.nome)
      setClienteId(configParaEditar.clienteId)
      setFrequencia(configParaEditar.frequencia)
      setDiaSemana(configParaEditar.diaSemana ?? 1)
      setDiaMes(configParaEditar.diaMes ?? 1)
      setPeriodoDias(configParaEditar.periodoDias !== null ? String(configParaEditar.periodoDias) : '')
      setHorarioEnvio(configParaEditar.horarioEnvio ?? '')
      setDestinoTipo((configParaEditar.destinoTipo as 'privado' | 'grupo') ?? 'privado')
      setDestinoValor(configParaEditar.destinoValor ?? '')
      setCabecalho(configParaEditar.cabecalho)
      setIncluirCompilado(configParaEditar.incluirCompilado)
      setMensagemCompilado(configParaEditar.mensagemCompilado ?? '')
      setBlocos(
        configParaEditar.blocos.map((b) => ({
          adAccountId: b.adAccountId,
          nivel: b.nivel,
          campanhasSelecionadas: b.campanhasSelecionadas ?? [],
          metricas: b.metricas,
          mensagem: b.mensagem,
        })),
      )
    } else {
      setNome('')
      setClienteId('')
      setFrequencia('semanal')
      setDiaSemana(1)
      setDiaMes(1)
      setPeriodoDias('')
      setHorarioEnvio('')
      setDestinoTipo('privado')
      setDestinoValor('')
      setCabecalho(CABECALHO_PADRAO)
      setIncluirCompilado(true)
      setMensagemCompilado('')
      setBlocos([blocoVazio()])
    }
    setPreview(null)
    setAvisosPreview([])
  }, [open, configParaEditar])

  // Carregar contas + campanhas quando o cliente muda
  useEffect(() => {
    if (!clienteId) {
      setContas([])
      return
    }
    setCarregandoContas(true)
    listarContasComCampanhas(clienteId)
      .then(setContas)
      .catch(() => setContas([]))
      .finally(() => setCarregandoContas(false))
  }, [clienteId])

  function inserirNoTextarea(
    ref: HTMLTextAreaElement | null,
    valorAtual: string,
    setValor: (v: string) => void,
    chave: string,
  ) {
    const token = `{{${chave}}}`
    if (!ref) {
      setValor(valorAtual + token)
      return
    }
    const inicio = ref.selectionStart ?? valorAtual.length
    const fim = ref.selectionEnd ?? valorAtual.length
    const novo = valorAtual.slice(0, inicio) + token + valorAtual.slice(fim)
    setValor(novo)
    requestAnimationFrame(() => {
      ref.focus()
      const pos = inicio + token.length
      ref.setSelectionRange(pos, pos)
    })
  }

  function atualizarBloco(idx: number, patch: Partial<BlocoDraft>) {
    setBlocos((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }

  function moverBloco(idx: number, direcao: -1 | 1) {
    setBlocos((prev) => {
      const alvo = idx + direcao
      if (alvo < 0 || alvo >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[alvo]] = [next[alvo], next[idx]]
      return next
    })
  }

  function nomeConta(adAccountId: string): string {
    return contas.find((c) => c.id === adAccountId)?.nome ?? `Bloco`
  }

  function aplicarTemplate(templateId: string) {
    const t = TEMPLATES_GALERIA.find((t) => t.id === templateId)
    if (!t) return
    setCabecalho(t.cabecalho)
    setBlocos((prev) =>
      prev.map((b) => ({
        ...b,
        mensagem: t.mensagemBloco,
        metricas: Array.from(new Set([...b.metricas, ...t.metricasSugeridas])),
      })),
    )
    toast.success(`Template "${t.nome}" aplicado a todos os blocos.`)
  }

  function montarDraft(): RelatorioConfigDraft {
    return {
      clienteId,
      nome,
      frequencia,
      diaSemana: frequencia === 'semanal' ? diaSemana : null,
      diaMes: frequencia === 'mensal' ? diaMes : null,
      periodoDias: periodoDias.trim() ? Number(periodoDias) : null,
      horarioEnvio: horarioEnvio.trim() || null,
      destinoTipo,
      destinoValor: destinoValor.trim() || null,
      cabecalho,
      incluirCompilado,
      mensagemCompilado: mensagemCompilado.trim() || null,
      blocos: blocos.map((b) => ({
        adAccountId: b.adAccountId,
        nivel: b.nivel,
        campanhasSelecionadas: b.nivel === 'campanhas' ? b.campanhasSelecionadas : null,
        metricas: b.metricas,
        mensagem: b.mensagem,
      })),
    }
  }

  async function handlePreview() {
    setGerandoPreview(true)
    setPreview(null)
    setAvisosPreview([])
    try {
      const result = await previewRelatorio(montarDraft())
      if (result.success) {
        setPreview(result.texto)
        setAvisosPreview(result.semDados)
        setEtapa('mensagens')
      } else {
        toast.error(result.error)
      }
    } finally {
      setGerandoPreview(false)
    }
  }

  async function handleSalvar() {
    setSalvando(true)
    try {
      const draft = montarDraft()
      const result = editando
        ? await atualizarRelatorioConfig(configParaEditar!.id, draft)
        : await criarRelatorioConfig(draft)
      if (result.success) {
        toast.success(editando ? 'Relatório atualizado com sucesso.' : 'Relatório criado com sucesso.')
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSalvando(false)
    }
  }

  async function handleCopiarPreview() {
    if (!preview) return
    await navigator.clipboard.writeText(preview)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const etapas = ['config', 'blocos', 'mensagens'] as const
  const idxEtapa = etapas.indexOf(etapa)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>{editando ? `Editar relatório – ${configParaEditar?.nome}` : 'Novo Relatório'}</DialogTitle>
          <DialogDescription>
            Relatório recorrente gerado automaticamente na data configurada, pronto para copiar no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={etapa} onValueChange={(v) => setEtapa(v as typeof etapa)} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-6 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="config" className="flex-1 gap-1.5">
                <Building2 className="size-4" /> 1. Configuração
              </TabsTrigger>
              <TabsTrigger value="blocos" className="flex-1 gap-1.5">
                <Layers className="size-4" /> 2. Blocos e métricas
              </TabsTrigger>
              <TabsTrigger value="mensagens" className="flex-1 gap-1.5">
                <MessageSquareText className="size-4" /> 3. Mensagens e preview
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {/* ---------- ETAPA 1: Configuração ---------- */}
            <TabsContent value="config" className="mt-0 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rel-nome">Nome do relatório *</Label>
                  <Input
                    id="rel-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: [Cliente] Semanal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cliente *</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Agendamento</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Frequência</Label>
                    <Select value={frequencia} onValueChange={(v) => setFrequencia(v as 'semanal' | 'mensal')}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {frequencia === 'semanal' ? (
                    <div className="space-y-1.5">
                      <Label>Dia da semana</Label>
                      <Select value={String(diaSemana)} onValueChange={(v) => setDiaSemana(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_SEMANA.map((d) => (
                            <SelectItem key={d.valor} value={String(d.valor)}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Dia do mês</Label>
                      <Select value={String(diaMes)} onValueChange={(v) => setDiaMes(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-periodo">Período dos dados (dias)</Label>
                    <Input
                      id="rel-periodo"
                      type="number"
                      min={1}
                      max={90}
                      value={periodoDias}
                      onChange={(e) => setPeriodoDias(e.target.value)}
                      placeholder={frequencia === 'semanal' ? '7 (padrão)' : 'Mês anterior (padrão)'}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {frequencia === 'semanal'
                    ? 'Ex.: toda segunda-feira com 7 dias = dados de segunda a domingo anteriores.'
                    : 'Sem período definido, usa o mês anterior completo.'}
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Envio automático no WhatsApp</p>
                  <Badge variant="outline" className="text-xs text-amber-600">Em breve</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Preencha agora e, quando a integração com o WhatsApp for ativada, tudo já estará pronto.
                  Por enquanto o relatório fica pronto para copiar e colar.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-horario">Horário de envio</Label>
                    <Input
                      id="rel-horario"
                      type="time"
                      value={horarioEnvio}
                      onChange={(e) => setHorarioEnvio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Destino</Label>
                    <Select value={destinoTipo} onValueChange={(v) => setDestinoTipo(v as 'privado' | 'grupo')}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="privado">Privado</SelectItem>
                        <SelectItem value="grupo">Grupo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-destino">{destinoTipo === 'privado' ? 'Número' : 'Nome do grupo'}</Label>
                    <Input
                      id="rel-destino"
                      value={destinoValor}
                      onChange={(e) => setDestinoValor(e.target.value)}
                      placeholder={destinoTipo === 'privado' ? 'Ex.: 71999999999' : 'Ex.: Grupo do cliente'}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ---------- ETAPA 2: Blocos e métricas ---------- */}
            <TabsContent value="blocos" className="mt-0 space-y-4">
              {!clienteId ? (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                  Selecione o cliente na etapa 1 para escolher as contas de anúncio.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Blocos de métricas</p>
                      <p className="text-xs text-muted-foreground">
                        Um bloco por conta de anúncio. O relatório final mostra os blocos na ordem abaixo.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBlocos((prev) => [...prev, blocoVazio()])}
                    >
                      <Plus className="size-4" />
                      Adicionar bloco
                    </Button>
                  </div>

                  {blocos.map((bloco, idx) => {
                    const conta = contas.find((c) => c.id === bloco.adAccountId)
                    const campanhasFiltradas = conta
                      ? conta.campanhas.filter((c) =>
                          c.campaignName.toLowerCase().includes(buscaCampanhas.toLowerCase()),
                        )
                      : []
                    return (
                      <div key={idx} className="overflow-hidden rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                          <span className="text-sm font-medium">
                            Bloco {idx + 1}{conta ? ` · ${conta.nome}` : ''}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon-sm" disabled={idx === 0} onClick={() => moverBloco(idx, -1)}>
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-sm" disabled={idx === blocos.length - 1} onClick={() => moverBloco(idx, 1)}>
                              <ArrowDown className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={blocos.length === 1}
                              onClick={() => setBlocos((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>Plataforma</Label>
                              <Select value="meta">
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="meta">Meta Ads</SelectItem>
                                  <SelectItem value="google" disabled>Google Ads — em breve</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Conta de anúncio *</Label>
                              <Select
                                value={bloco.adAccountId}
                                onValueChange={(v) => atualizarBloco(idx, { adAccountId: v, campanhasSelecionadas: [] })}
                                disabled={carregandoContas}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder={carregandoContas ? 'Carregando...' : 'Selecione a conta'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {contas.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Nível: cards clicáveis */}
                          <div className="space-y-1.5">
                            <Label>Nível do relatório</Label>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => atualizarBloco(idx, { nivel: 'conta' })}
                                className={`rounded-lg border p-3 text-left transition-colors ${
                                  bloco.nivel === 'conta'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <p className="text-sm font-medium">Conta inteira</p>
                                <p className="text-xs text-muted-foreground">Métricas consolidadas de toda a conta</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => atualizarBloco(idx, { nivel: 'campanhas' })}
                                className={`rounded-lg border p-3 text-left transition-colors ${
                                  bloco.nivel === 'campanhas'
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <p className="text-sm font-medium">Campanhas selecionadas</p>
                                <p className="text-xs text-muted-foreground">Somente as campanhas que você marcar</p>
                              </button>
                            </div>
                          </div>

                          {bloco.nivel === 'campanhas' && (
                            <div className="space-y-2 rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="shrink-0">Selecionar campanhas</Label>
                                <span className="text-xs text-muted-foreground">
                                  {bloco.campanhasSelecionadas.length} de {conta?.campanhas.length ?? 0} selecionadas
                                </span>
                              </div>
                              {!conta ? (
                                <p className="text-xs text-muted-foreground">Selecione a conta acima para listar as campanhas.</p>
                              ) : conta.campanhas.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhuma campanha com dados nos últimos 90 dias.</p>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={buscaCampanhas}
                                      onChange={(e) => setBuscaCampanhas(e.target.value)}
                                      placeholder="Buscar campanhas..."
                                      className="h-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="shrink-0"
                                      onClick={() =>
                                        atualizarBloco(idx, {
                                          campanhasSelecionadas:
                                            bloco.campanhasSelecionadas.length === conta.campanhas.length
                                              ? []
                                              : conta.campanhas.map((c) => c.campaignId),
                                        })
                                      }
                                    >
                                      {bloco.campanhasSelecionadas.length === conta.campanhas.length ? 'Limpar' : 'Selecionar todas'}
                                    </Button>
                                  </div>
                                  <div className="max-h-44 space-y-1 overflow-y-auto">
                                    {campanhasFiltradas.map((camp) => {
                                      const marcada = bloco.campanhasSelecionadas.includes(camp.campaignId)
                                      return (
                                        <label
                                          key={camp.campaignId}
                                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors ${
                                            marcada ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/50'
                                          }`}
                                        >
                                          <Checkbox
                                            checked={marcada}
                                            onCheckedChange={(v) =>
                                              atualizarBloco(idx, {
                                                campanhasSelecionadas: v
                                                  ? [...bloco.campanhasSelecionadas, camp.campaignId]
                                                  : bloco.campanhasSelecionadas.filter((id) => id !== camp.campaignId),
                                              })
                                            }
                                          />
                                          <span className="truncate">{camp.campaignName}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Métricas em pills por categoria */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label>Métricas do bloco *</Label>
                              <span className="text-xs text-muted-foreground">
                                {bloco.metricas.length} selecionada{bloco.metricas.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="space-y-2 rounded-md border p-3">
                              {CATEGORIAS_METRICAS.map((cat) => (
                                <div key={cat} className="flex flex-wrap items-center gap-1.5">
                                  <span className="w-24 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {LABELS_CATEGORIA[cat]}
                                  </span>
                                  {CATALOGO_VARIAVEIS.filter((v) => v.categoria === cat).map((v) => {
                                    const marcada = bloco.metricas.includes(v.chave)
                                    return (
                                      <button
                                        key={v.chave}
                                        type="button"
                                        onClick={() =>
                                          atualizarBloco(idx, {
                                            metricas: marcada
                                              ? bloco.metricas.filter((m) => m !== v.chave)
                                              : [...bloco.metricas, v.chave],
                                          })
                                        }
                                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                          marcada
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                        }`}
                                      >
                                        {v.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Na etapa 3 você pode gerar a mensagem do bloco automaticamente a partir dessas métricas.
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </TabsContent>

            {/* ---------- ETAPA 3: Mensagens e preview ---------- */}
            <TabsContent value="mensagens" className="mt-0 space-y-5">
              {/* Galeria de templates */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-sm font-medium">Templates prontos</p>
                  <span className="text-xs text-muted-foreground">— aplica cabeçalho e mensagem em todos os blocos</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TEMPLATES_GALERIA.map((t) => (
                    <div key={t.id} className="flex flex-col justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{t.nome}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.descricao}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => aplicarTemplate(t.id)}
                      >
                        Usar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cabeçalho */}
              <div className="space-y-1.5">
                <Label htmlFor="rel-cabecalho">Cabeçalho do relatório</Label>
                <Textarea
                  id="rel-cabecalho"
                  ref={cabecalhoRef}
                  value={cabecalho}
                  onChange={(e) => setCabecalho(e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                />
                <ChipsVariaveis
                  categorias={['gerais']}
                  onInserir={(chave) => inserirNoTextarea(cabecalhoRef.current, cabecalho, setCabecalho, chave)}
                />
              </div>

              {/* Mensagem por bloco */}
              {blocos.map((bloco, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>
                      Mensagem do bloco {idx + 1}
                      {bloco.adAccountId ? ` · ${nomeConta(bloco.adAccountId)}` : ''}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={bloco.metricas.length === 0}
                      onClick={() => atualizarBloco(idx, { mensagem: montarMensagemDeMetricas(bloco.metricas) })}
                    >
                      <Wand2 className="size-4" />
                      Gerar pelas métricas
                    </Button>
                  </div>
                  <Textarea
                    ref={(el) => { blocoRefs.current[idx] = el }}
                    value={bloco.mensagem}
                    onChange={(e) => atualizarBloco(idx, { mensagem: e.target.value })}
                    placeholder='Escreva a mensagem ou clique em "Gerar pelas métricas".'
                    className="min-h-[120px] font-mono text-sm"
                  />
                  <ChipsVariaveis
                    categorias={['gerais', ...CATEGORIAS_METRICAS]}
                    onInserir={(chave) =>
                      inserirNoTextarea(
                        blocoRefs.current[idx],
                        bloco.mensagem,
                        (v) => atualizarBloco(idx, { mensagem: v }),
                        chave,
                      )
                    }
                  />
                </div>
              ))}

              {/* Resumo compilado */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Resumo compilado no final</Label>
                    <p className="text-xs text-muted-foreground">
                      Soma investimento e resultados de todos os blocos (aparece quando há 2+ blocos).
                    </p>
                  </div>
                  <Switch checked={incluirCompilado} onCheckedChange={setIncluirCompilado} />
                </div>
                {incluirCompilado && (
                  <div className="space-y-1.5">
                    <Textarea
                      ref={compiladoRef}
                      value={mensagemCompilado}
                      onChange={(e) => setMensagemCompilado(e.target.value)}
                      placeholder="Vazio = resumo padrão (investimento, leads, conversas, compras, receita, ROAS)."
                      className="min-h-[80px] font-mono text-sm"
                    />
                    <ChipsVariaveis
                      categorias={['gerais', ...CATEGORIAS_METRICAS]}
                      onInserir={(chave) =>
                        inserirNoTextarea(compiladoRef.current, mensagemCompilado, setMensagemCompilado, chave)
                      }
                    />
                  </div>
                )}
              </div>

              {/* Preview */}
              {preview !== null && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <Label>Preview com dados reais do último período</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopiarPreview}>
                      {copiado ? <CheckCircle2 className="size-4 text-green-600" /> : <Copy className="size-4" />}
                      {copiado ? 'Copiado!' : 'Copiar'}
                    </Button>
                  </div>
                  {avisosPreview.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {avisosPreview.map((aviso) => (
                        <Badge key={aviso} variant="outline" className="text-xs text-amber-600">{aviso}</Badge>
                      ))}
                    </div>
                  )}
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-sm">
                    {preview}
                  </pre>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 border-t px-6 py-4">
          {idxEtapa > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEtapa(etapas[idxEtapa - 1])}
              className="mr-auto"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {idxEtapa < 2 ? (
            <Button type="button" onClick={() => setEtapa(etapas[idxEtapa + 1])}>
              Avançar
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={handlePreview} disabled={gerandoPreview}>
                {gerandoPreview ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                Ver preview
              </Button>
              <Button type="button" onClick={handleSalvar} disabled={salvando}>
                {salvando && <Loader2 className="size-4 animate-spin" />}
                {editando ? 'Salvar alterações' : 'Criar relatório'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
