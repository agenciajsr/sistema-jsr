'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, CheckCircle2, Eye, Loader2, Plus, Trash2 } from 'lucide-react'
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
import { CATALOGO_VARIAVEIS, LABELS_CATEGORIA, type CategoriaVariavel } from '@/lib/relatorios/variaveis'
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

const CATEGORIAS_ORDEM: CategoriaVariavel[] = [
  'gerais', 'investimento', 'cliques', 'leads', 'conversas', 'vendas', 'pagina',
]

const CABECALHO_PADRAO =
  '📊 Relatório – {{cliente}}\n📅 Período: {{date_range}}\n🚀 Agência: JSR Tráfego\nBom dia! Segue o resumo do período 👇'

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
    <div className="space-y-1.5">
      {categorias.map((cat) => {
        const vars = CATALOGO_VARIAVEIS.filter((v) => v.categoria === cat)
        if (vars.length === 0) return null
        return (
          <div key={cat} className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {LABELS_CATEGORIA[cat]}
            </span>
            {vars.map((v) => (
              <button
                key={v.chave}
                type="button"
                title={v.label}
                onClick={() => onInserir(v.chave)}
                className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editando ? `Editar relatório – ${configParaEditar?.nome}` : 'Novo Relatório'}</DialogTitle>
          <DialogDescription>
            Configure um relatório recorrente com blocos de métricas por conta de anúncio, pronto para copiar no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* --- Dados gerais --- */}
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rel-nome">Nome do relatório</Label>
                <Input
                  id="rel-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: [Cliente] Semanal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
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

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select value={frequencia} onValueChange={(v) => setFrequencia(v as 'semanal' | 'mensal')}>
                  <SelectTrigger>
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rel-horario">Horário de envio</Label>
                <Input
                  id="rel-horario"
                  type="time"
                  value={horarioEnvio}
                  onChange={(e) => setHorarioEnvio(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Envio no horário exato disponível em breve.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Destino no WhatsApp</Label>
                <Select value={destinoTipo} onValueChange={(v) => setDestinoTipo(v as 'privado' | 'grupo')}>
                  <SelectTrigger>
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
                <p className="text-xs text-muted-foreground">Envio automático em breve — por enquanto, copie e cole.</p>
              </div>
            </div>
          </section>

          {/* --- Cabeçalho --- */}
          <section className="space-y-2">
            <Label htmlFor="rel-cabecalho">Cabeçalho do relatório</Label>
            <Textarea
              id="rel-cabecalho"
              ref={cabecalhoRef}
              value={cabecalho}
              onChange={(e) => setCabecalho(e.target.value)}
              className="min-h-[90px] font-mono text-sm"
            />
            <ChipsVariaveis
              categorias={['gerais']}
              onInserir={(chave) => inserirNoTextarea(cabecalhoRef.current, cabecalho, setCabecalho, chave)}
            />
          </section>

          {/* --- Blocos de métricas --- */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Blocos de métricas</Label>
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
              return (
                <div key={idx} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Bloco {idx + 1}</span>
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

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Plataforma</Label>
                      <Select value="meta">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meta">Meta Ads</SelectItem>
                          <SelectItem value="google" disabled>Google Ads — em breve</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Conta de anúncio</Label>
                      <Select
                        value={bloco.adAccountId}
                        onValueChange={(v) => atualizarBloco(idx, { adAccountId: v, campanhasSelecionadas: [] })}
                        disabled={!clienteId || carregandoContas}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !clienteId ? 'Selecione o cliente antes' : carregandoContas ? 'Carregando...' : 'Selecione a conta'
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {contas.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nível</Label>
                      <Select
                        value={bloco.nivel}
                        onValueChange={(v) => atualizarBloco(idx, { nivel: v as 'conta' | 'campanhas' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conta">Conta inteira</SelectItem>
                          <SelectItem value="campanhas">Campanhas selecionadas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {bloco.nivel === 'campanhas' && (
                    <div className="space-y-1.5">
                      <Label>Campanhas</Label>
                      {!conta ? (
                        <p className="text-xs text-muted-foreground">Selecione a conta para listar as campanhas.</p>
                      ) : conta.campanhas.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma campanha com dados nos últimos 90 dias.</p>
                      ) : (
                        <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
                          {conta.campanhas.map((camp) => {
                            const marcada = bloco.campanhasSelecionadas.includes(camp.campaignId)
                            return (
                              <label key={camp.campaignId} className="flex items-center gap-2 text-sm">
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
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Métricas do bloco</Label>
                    <div className="space-y-2 rounded-md border p-2">
                      {CATEGORIAS_ORDEM.filter((c) => c !== 'gerais').map((cat) => (
                        <div key={cat} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="w-24 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {LABELS_CATEGORIA[cat]}
                          </span>
                          {CATALOGO_VARIAVEIS.filter((v) => v.categoria === cat).map((v) => {
                            const marcada = bloco.metricas.includes(v.chave)
                            return (
                              <label key={v.chave} className="flex items-center gap-1.5 text-xs">
                                <Checkbox
                                  checked={marcada}
                                  onCheckedChange={(on) =>
                                    atualizarBloco(idx, {
                                      metricas: on
                                        ? [...bloco.metricas, v.chave]
                                        : bloco.metricas.filter((m) => m !== v.chave),
                                    })
                                  }
                                />
                                {v.label}
                              </label>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Mensagem do bloco</Label>
                      <Select
                        value=""
                        onValueChange={(id) => {
                          const t = TEMPLATES_GALERIA.find((t) => t.id === id)
                          if (!t) return
                          atualizarBloco(idx, {
                            mensagem: t.mensagemBloco,
                            metricas: Array.from(new Set([...bloco.metricas, ...t.metricasSugeridas])),
                          })
                        }}
                      >
                        <SelectTrigger size="sm" className="w-[210px]">
                          <SelectValue placeholder="Aplicar template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATES_GALERIA.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div>
                                <div>{t.nome}</div>
                                <div className="text-xs text-muted-foreground">{t.descricao}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      ref={(el) => { blocoRefs.current[idx] = el }}
                      value={bloco.mensagem}
                      onChange={(e) => atualizarBloco(idx, { mensagem: e.target.value })}
                      placeholder="Escreva a mensagem do bloco ou aplique um template. Use as variáveis abaixo."
                      className="min-h-[120px] font-mono text-sm"
                    />
                    <ChipsVariaveis
                      categorias={CATEGORIAS_ORDEM}
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
                </div>
              )
            })}
          </section>

          {/* --- Resumo compilado --- */}
          <section className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Incluir resumo compilado</Label>
                <p className="text-xs text-muted-foreground">
                  Bloco final somando investimento e resultados de todos os blocos (aparece quando há 2+ blocos).
                </p>
              </div>
              <Switch checked={incluirCompilado} onCheckedChange={setIncluirCompilado} />
            </div>
            {incluirCompilado && (
              <div className="space-y-1.5">
                <Label>Mensagem do compilado (opcional)</Label>
                <Textarea
                  ref={compiladoRef}
                  value={mensagemCompilado}
                  onChange={(e) => setMensagemCompilado(e.target.value)}
                  placeholder="Vazio = resumo padrão (investimento, leads, conversas, compras, receita, ROAS)."
                  className="min-h-[90px] font-mono text-sm"
                />
                <ChipsVariaveis
                  categorias={CATEGORIAS_ORDEM}
                  onInserir={(chave) =>
                    inserirNoTextarea(compiladoRef.current, mensagemCompilado, setMensagemCompilado, chave)
                  }
                />
              </div>
            )}
          </section>

          {/* --- Preview --- */}
          {preview !== null && (
            <section className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <Label>Preview (dados reais do último período)</Label>
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
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-sm">
                {preview}
              </pre>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={gerandoPreview}>
            {gerandoPreview ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            Ver preview
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar relatório'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
