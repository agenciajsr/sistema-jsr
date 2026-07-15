'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  ListOrdered,
  Loader2,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  atualizarEtapa,
  criarEtapa,
  criarPipelineComEtapas,
  definirPipelinePadrao,
  excluirEtapa,
  excluirPipeline,
  renomearPipeline,
  reordenarEtapas,
} from '@/actions/crm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KpisCrm } from '@/components/crm/kpis-crm'
import { KanbanCrm } from '@/components/crm/kanban-crm'
import { ListaCrm } from '@/components/crm/lista-crm'
import { BarraOrigemLeads } from '@/components/crm/barra-origem-leads'
import { NovoLeadDialog } from '@/components/crm/novo-lead-dialog'
import { nomeOrigem } from '@/lib/crm/origem'
import { rotuloServico, SERVICOS_JSR, type ServicoJsr } from '@/lib/crm/servicos'
import type { CrmVisaoGeral } from '@/lib/crm/dados'

// Orquestrador da /crm: header compacto + seletor de pipelines (multi-pipeline)
// + abas Kanban/Lista + busca + filtros por servico/origem + gerenciamento de
// pipelines (criar/renomear/padrao/excluir). O periodo continua inerte (honesto).

export function CrmView({ dados }: { dados: CrmVisaoGeral }) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [filtroServicos, setFiltroServicos] = useState<Set<string>>(new Set())
  const [filtroOrigens, setFiltroOrigens] = useState<Set<string>>(new Set())

  // Gerenciamento de pipelines.
  const [dialogPipeline, setDialogPipeline] = useState<'nova' | 'renomear' | null>(null)
  const [nomePipeline, setNomePipeline] = useState('')
  const [salvandoPipeline, setSalvandoPipeline] = useState(false)
  const [confirmarExcluirPipeline, setConfirmarExcluirPipeline] = useState(false)

  // Edicao das ETAPAS do pipeline atual (ex.: Briefing → Planejamento → ...).
  const [dialogEtapas, setDialogEtapas] = useState(false)
  const [nomesEtapas, setNomesEtapas] = useState<Record<string, string>>({})
  const [novaEtapaNome, setNovaEtapaNome] = useState('')
  const [salvandoEtapa, setSalvandoEtapa] = useState(false)

  // Origens presentes no board (para o filtro) — vem da distribuicao ja carregada.
  const origensDisponiveis = dados.origens.map((o) => o.origem)

  const temFiltro = filtroServicos.size > 0 || filtroOrigens.size > 0

  // Busca + filtros CLIENT-SIDE sobre os cards ja carregados (lead-first:
  // nome do lead, empresa e servico). Sem termo e sem filtro => undefined
  // => mostra tudo. Varre TAMBEM as colunasFechadas.
  const oportunidadesVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo && !temFiltro) return undefined
    const ids = new Set<string>()
    const todas = [
      ...dados.colunas.map((c) => c.oportunidades),
      ...dados.colunasFechadas.map((c) => c.oportunidades),
    ]
    for (const oportunidades of todas) {
      for (const o of oportunidades) {
        if (termo) {
          const alvo = `${o.contatoNome ?? ''} ${o.empresaNome ?? ''} ${rotuloServico(
            o.servico
          )} ${o.titulo}`.toLowerCase()
          if (!alvo.includes(termo)) continue
        }
        if (filtroServicos.size > 0 && !filtroServicos.has(o.servico ?? '')) continue
        if (filtroOrigens.size > 0 && !filtroOrigens.has(o.origem ?? 'outro')) continue
        ids.add(o.id)
      }
    }
    return ids
  }, [busca, temFiltro, filtroServicos, filtroOrigens, dados.colunas, dados.colunasFechadas])

  function alternarNoSet(set: Set<string>, valor: string): Set<string> {
    const novo = new Set(set)
    if (novo.has(valor)) novo.delete(valor)
    else novo.add(valor)
    return novo
  }

  async function salvarPipeline() {
    const nome = nomePipeline.trim()
    if (nome.length < 2) {
      toast.error('Informe o nome do pipeline.')
      return
    }
    setSalvandoPipeline(true)
    try {
      if (dialogPipeline === 'nova') {
        const result = await criarPipelineComEtapas({ nome })
        if ('error' in result && result.error) {
          toast.error(result.error)
          return
        }
        toast.success(`Pipeline "${nome}" criado com as etapas padrão.`)
        const id = (result as { data: { id: string } }).data.id
        router.push(`/crm?pipeline=${id}`)
      } else if (dialogPipeline === 'renomear' && dados.pipelineId) {
        const result = await renomearPipeline(dados.pipelineId, { nome })
        if ('error' in result && result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Pipeline renomeado.')
        router.refresh()
      }
      setDialogPipeline(null)
    } finally {
      setSalvandoPipeline(false)
    }
  }

  async function tornarPadrao() {
    if (!dados.pipelineId) return
    const result = await definirPipelinePadrao(dados.pipelineId)
    if ('error' in result && result.error) toast.error(result.error)
    else {
      toast.success('Este agora é o pipeline padrão.')
      router.refresh()
    }
  }

  async function excluirPipelineAtual() {
    if (!dados.pipelineId) return
    const result = await excluirPipeline(dados.pipelineId)
    if ('error' in result && result.error) toast.error(result.error)
    else {
      toast.success('Pipeline excluído.')
      router.push('/crm')
    }
    setConfirmarExcluirPipeline(false)
  }

  const pipelineAtual = dados.pipelines.find((p) => p.id === dados.pipelineId)

  // --- Edicao de etapas ---

  async function salvarNomeEtapa(etapaId: string) {
    const etapa = dados.etapas.find((e) => e.id === etapaId)
    const nome = (nomesEtapas[etapaId] ?? '').trim()
    if (!etapa || !nome || nome === etapa.nome) return
    const result = await atualizarEtapa(etapaId, {
      nome,
      cor: etapa.cor ?? undefined,
      probabilidade: etapa.probabilidade ?? undefined,
    })
    if ('error' in result && result.error) toast.error(result.error)
    else router.refresh()
  }

  async function moverEtapa(etapaId: string, direcao: -1 | 1) {
    if (!dados.pipelineId) return
    const ids = dados.etapas.map((e) => e.id)
    const idx = ids.indexOf(etapaId)
    const alvo = idx + direcao
    if (idx < 0 || alvo < 0 || alvo >= ids.length) return
    ;[ids[idx], ids[alvo]] = [ids[alvo], ids[idx]]
    const result = await reordenarEtapas(dados.pipelineId, ids)
    if ('error' in result && result.error) toast.error(result.error)
    else router.refresh()
  }

  async function removerEtapa(etapaId: string) {
    const result = await excluirEtapa(etapaId)
    if ('error' in result && result.error) toast.error(result.error)
    else {
      toast.success('Etapa excluída.')
      router.refresh()
    }
  }

  async function adicionarEtapa() {
    if (!dados.pipelineId) return
    const nome = novaEtapaNome.trim()
    if (!nome) {
      toast.error('Informe o nome da etapa.')
      return
    }
    setSalvandoEtapa(true)
    try {
      const result = await criarEtapa(dados.pipelineId, { nome })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      setNovaEtapaNome('')
      toast.success('Etapa criada no fim do funil.')
      router.refresh()
    } finally {
      setSalvandoEtapa(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header compacto: titulo + seletor de pipeline + periodo na MESMA faixa. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          </div>

          {/* Seletor de pipelines (multi-pipeline). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-[var(--shadow-sm)] transition-colors hover:bg-accent/50"
              >
                <span className="size-2 rounded-full bg-primary" />
                <span className="text-sm font-medium">{dados.pipelineNome}</span>
                {pipelineAtual?.padrao && (
                  <Badge variant="secondary" className="text-[10px]">
                    Padrão
                  </Badge>
                )}
                <ChevronDown className="size-4 text-muted-foreground/60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Pipelines</DropdownMenuLabel>
              {dados.pipelines.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => router.push(`/crm?pipeline=${p.id}`)}
                >
                  <span className="flex-1 truncate">{p.nome}</span>
                  {p.padrao && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                  {p.id === dados.pipelineId && <Check className="size-4 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setNomePipeline('')
                  setDialogPipeline('nova')
                }}
              >
                <Plus className="size-4" />
                Nova pipeline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Periodo: inerte por ora (o recorte por data ainda nao existe). */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-not-allowed text-muted-foreground"
          title="Em breve"
        >
          <CalendarDays className="size-4" />
          Selecione um periodo
        </Button>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <NovoLeadDialog etapas={dados.etapas} />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar lead, empresa ou servico..."
                className="w-64 pl-8"
                aria-label="Buscar leads"
              />
            </div>

            {/* Filtros por servico e origem (client-side). */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={temFiltro ? 'default' : 'outline'}
                  size="icon"
                  aria-label="Filtros"
                  title="Filtros"
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Servico
                  </p>
                  <div className="space-y-1.5">
                    {(Object.keys(SERVICOS_JSR) as ServicoJsr[]).map((chave) => (
                      <label key={chave} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={filtroServicos.has(chave)}
                          onCheckedChange={() =>
                            setFiltroServicos((s) => alternarNoSet(s, chave))
                          }
                        />
                        {SERVICOS_JSR[chave]}
                      </label>
                    ))}
                  </div>
                </div>
                {origensDisponiveis.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Origem
                    </p>
                    <div className="space-y-1.5">
                      {origensDisponiveis.map((origem) => (
                        <label key={origem} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={filtroOrigens.has(origem)}
                            onCheckedChange={() =>
                              setFiltroOrigens((s) => alternarNoSet(s, origem))
                            }
                          />
                          {nomeOrigem(origem)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {temFiltro && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setFiltroServicos(new Set())
                      setFiltroOrigens(new Set())
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Configuracoes do pipeline atual. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Configuracoes do pipeline"
                  title="Configuracoes do pipeline"
                >
                  <Settings2 className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {dados.pipelineNome}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setNomePipeline(dados.pipelineNome ?? '')
                    setDialogPipeline('renomear')
                  }}
                >
                  Renomear pipeline
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setNomesEtapas({})
                    setDialogEtapas(true)
                  }}
                >
                  <ListOrdered className="size-4" />
                  Editar etapas
                </DropdownMenuItem>
                {!pipelineAtual?.padrao && (
                  <DropdownMenuItem onClick={tornarPadrao}>
                    <Star className="size-4" />
                    Definir como padrão
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={dados.pipelines.length <= 1}
                  onClick={() => setConfirmarExcluirPipeline(true)}
                >
                  <Trash2 className="size-4" />
                  Excluir pipeline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="size-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="lista">
              <List className="size-4" />
              Lista
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban" className="space-y-4">
          <KpisCrm kpis={dados.kpis} />
          <KanbanCrm
            colunas={dados.colunas}
            colunasFechadas={dados.colunasFechadas}
            oportunidadesVisiveis={oportunidadesVisiveis}
          />
          <BarraOrigemLeads origens={dados.origens} />
        </TabsContent>

        <TabsContent value="lista">
          <ListaCrm
            colunas={dados.colunas}
            colunasFechadas={dados.colunasFechadas}
            oportunidadesVisiveis={oportunidadesVisiveis}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog nova pipeline / renomear. */}
      <Dialog open={dialogPipeline !== null} onOpenChange={(open) => !open && setDialogPipeline(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogPipeline === 'nova' ? 'Nova pipeline' : 'Renomear pipeline'}
            </DialogTitle>
            <DialogDescription>
              {dialogPipeline === 'nova'
                ? 'A pipeline nasce com as 6 etapas padrão — ex.: Operações (gestão de projetos) ou Produção (calendário de conteúdo).'
                : 'Altere o nome da pipeline atual.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nome-pipeline">Nome</Label>
            <Input
              id="nome-pipeline"
              value={nomePipeline}
              onChange={(e) => setNomePipeline(e.target.value)}
              placeholder="Ex.: Operações"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void salvarPipeline()
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogPipeline(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvarPipeline} disabled={salvandoPipeline}>
              {salvandoPipeline && <Loader2 className="size-4 animate-spin" />}
              {dialogPipeline === 'nova' ? 'Criar pipeline' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar etapas do pipeline atual. */}
      <Dialog open={dialogEtapas} onOpenChange={setDialogEtapas}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Etapas de “{dados.pipelineNome}”</DialogTitle>
            <DialogDescription>
              Renomeie, reordene, adicione ou exclua as etapas do funil — ex.: Briefing,
              Planejamento, Produção, Revisão, Aprovação, Entregue. Etapa com negócios não
              pode ser excluída (mova-os antes).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {dados.etapas.map((etapa, idx) => (
              <div key={etapa.id} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: etapa.cor ?? 'var(--border)' }}
                />
                <Input
                  value={nomesEtapas[etapa.id] ?? etapa.nome}
                  onChange={(e) =>
                    setNomesEtapas((prev) => ({ ...prev, [etapa.id]: e.target.value }))
                  }
                  onBlur={() => void salvarNomeEtapa(etapa.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  className="h-8 flex-1"
                />
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {etapa.probabilidade != null ? `${etapa.probabilidade}%` : '—'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === 0}
                  onClick={() => void moverEtapa(etapa.id, -1)}
                  aria-label="Mover etapa para cima"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === dados.etapas.length - 1}
                  onClick={() => void moverEtapa(etapa.id, 1)}
                  aria-label="Mover etapa para baixo"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={dados.etapas.length <= 1}
                  onClick={() => void removerEtapa(etapa.id)}
                  aria-label="Excluir etapa"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}

            {/* Adicionar etapa no fim do funil. */}
            <div className="flex items-center gap-2 border-t pt-3">
              <Input
                value={novaEtapaNome}
                onChange={(e) => setNovaEtapaNome(e.target.value)}
                placeholder="Nova etapa (ex.: Briefing)"
                className="h-8 flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void adicionarEtapa()
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvandoEtapa}
                onClick={() => void adicionarEtapa()}
              >
                {salvandoEtapa ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setDialogEtapas(false)}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmacao de exclusao de pipeline. */}
      <AlertDialog open={confirmarExcluirPipeline} onOpenChange={setConfirmarExcluirPipeline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a pipeline “{dados.pipelineNome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir uma pipeline sem negócios — mova ou exclua os negócios antes.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirPipelineAtual}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
