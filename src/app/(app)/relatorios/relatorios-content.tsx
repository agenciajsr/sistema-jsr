'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { listarClientesRelatorio, listarHistoricoRelatorios, type RelatorioHistorico } from '@/actions/relatorios'
import {
  alternarAtivoRelatorioConfig,
  excluirRelatorioConfig,
  gerarRelatorioAgoraDaConfig,
  listarRelatorioConfigs,
  type RelatorioConfigResumo,
} from '@/actions/relatorio-configs'
import { NovoRelatorioDialog } from './novo-relatorio-dialog'

const LABEL_DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function labelFrequencia(config: RelatorioConfigResumo): string {
  if (config.frequencia === 'semanal') {
    return `Semanal · ${LABEL_DIA_SEMANA[config.diaSemana ?? 1]}`
  }
  return `Mensal · dia ${config.diaMes ?? 1}`
}

function labelTipoHistorico(tipo: string): string {
  if (tipo === 'automatico') return 'Automático'
  if (tipo === 'semanal') return 'Semanal'
  return 'Manual'
}

function formatarDiaMes(data: string): string {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

function formatarDataBR(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDataHoraBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function RelatoriosContent() {
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [configs, setConfigs] = useState<RelatorioConfigResumo[]>([])
  const [historico, setHistorico] = useState<RelatorioHistorico[]>([])
  const [loaded, setLoaded] = useState(false)

  const [dialogAberto, setDialogAberto] = useState(false)
  const [configEmEdicao, setConfigEmEdicao] = useState<RelatorioConfigResumo | null>(null)
  const [configParaExcluir, setConfigParaExcluir] = useState<RelatorioConfigResumo | null>(null)

  const [copiado, setCopiado] = useState<string | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)
  const [relatorioAberto, setRelatorioAberto] = useState<string | null>(null)
  const [historicoExpandido, setHistoricoExpandido] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      listarClientesRelatorio().catch(() => []),
      listarRelatorioConfigs().catch(() => []),
      listarHistoricoRelatorios().catch(() => []),
    ]).then(([cli, cfg, hist]) => {
      setClientes(cli.map((c) => ({ id: c.id, nome: c.nome })))
      setConfigs(cfg)
      setHistorico(hist)
      setLoaded(true)
    })
  }, [])

  function recarregar() {
    listarRelatorioConfigs().then(setConfigs).catch(() => {})
    listarHistoricoRelatorios().then(setHistorico).catch(() => {})
  }

  // Agrupar configs por cliente (um card por cliente)
  const porCliente = useMemo(() => {
    const grupos = new Map<string, { clienteNome: string; configs: RelatorioConfigResumo[] }>()
    for (const config of configs) {
      const grupo = grupos.get(config.clienteId) ?? { clienteNome: config.clienteNome, configs: [] }
      grupo.configs.push(config)
      grupos.set(config.clienteId, grupo)
    }
    return Array.from(grupos.entries())
      .map(([clienteId, g]) => ({ clienteId, ...g }))
      .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, 'pt-BR'))
  }, [configs])

  const totalAtivos = configs.filter((c) => c.ativo).length

  async function handleAlternarAtivo(config: RelatorioConfigResumo, ativo: boolean) {
    setConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, ativo } : c)))
    const result = await alternarAtivoRelatorioConfig(config.id, ativo)
    if (!result.success) {
      toast.error(result.error)
      setConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, ativo: !ativo } : c)))
      return
    }
    recarregar()
  }

  async function handleExcluirConfig() {
    if (!configParaExcluir) return
    const result = await excluirRelatorioConfig(configParaExcluir.id)
    if (result.success) {
      toast.success('Configuração excluída.')
      setConfigs((prev) => prev.filter((c) => c.id !== configParaExcluir.id))
    } else {
      toast.error(result.error)
    }
    setConfigParaExcluir(null)
  }

  async function handleGerarAgora(config: RelatorioConfigResumo) {
    setGerando(config.id)
    try {
      const result = await gerarRelatorioAgoraDaConfig(config.id)
      if (result.success) {
        toast.success('Relatório gerado no formato configurado.')
        setRelatorioAberto(config.id)
        recarregar()
      } else {
        toast.error(result.error)
      }
    } finally {
      setGerando(null)
    }
  }

  async function copiarTexto(id: string, texto: string) {
    await navigator.clipboard.writeText(texto)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  if (!loaded) {
    return <div className="text-sm text-muted-foreground">Carregando relatórios...</div>
  }

  return (
    <div className="space-y-6">
      {/* Banner de status */}
      <Card className="border-none bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Relatórios Automatizados</p>
              <p className="text-sm text-muted-foreground">
                Gerados automaticamente na data configurada — prontos para copiar e enviar no WhatsApp.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-semibold">{configs.length}</p>
              <p className="text-xs text-muted-foreground">configurados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-green-600">{totalAtivos}</p>
              <p className="text-xs text-muted-foreground">ativos</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
              <Zap className="size-4 text-amber-500" />
              <div>
                <p className="text-xs font-medium">Envio automático</p>
                <p className="text-[11px] text-muted-foreground">WhatsApp em breve</p>
              </div>
            </div>
            <Button onClick={() => { setConfigEmEdicao(null); setDialogAberto(true) }}>
              <Plus className="size-4" />
              Novo Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards por cliente */}
      {porCliente.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Nenhum relatório configurado</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Crie o primeiro relatório de um cliente: escolha as contas, as métricas e o formato da mensagem.
                Ele será gerado automaticamente toda semana (ou mês) e ficará pronto aqui para copiar.
              </p>
            </div>
            <Button className="mt-2" onClick={() => { setConfigEmEdicao(null); setDialogAberto(true) }}>
              <Plus className="size-4" />
              Criar primeiro relatório
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {porCliente.map((grupo) => (
            <Card key={grupo.clienteId} className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{grupo.clienteNome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {grupo.configs.map((config) => {
                  const aberto = relatorioAberto === config.id
                  return (
                    <div key={config.id} className="rounded-lg border">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{config.nome}</span>
                            <Badge
                              variant={config.ativo ? 'secondary' : 'outline'}
                              className={config.ativo ? 'bg-green-100 text-green-800' : ''}
                            >
                              {config.ativo ? 'Ativo' : 'Pausado'}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{labelFrequencia(config)}</span>
                            <span className="flex items-center gap-1">
                              <CalendarClock className="size-3" />
                              Próximo: {formatarDataBR(config.proximoEnvio)}
                            </span>
                            <span>{config.blocos.length} bloco{config.blocos.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={config.ativo}
                            onCheckedChange={(v) => handleAlternarAtivo(config, v)}
                            aria-label={config.ativo ? 'Pausar relatório' : 'Ativar relatório'}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => { setConfigEmEdicao(config); setDialogAberto(true) }}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setConfigParaExcluir(config)}
                            title="Excluir"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Último relatório gerado + ações */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground">
                          {config.ultimoGerado
                            ? `Último gerado: ${formatarDataHoraBr(config.ultimoGerado.geradoEm)} · ${formatarDiaMes(config.ultimoGerado.periodoInicio)} a ${formatarDiaMes(config.ultimoGerado.periodoFim)}`
                            : 'Nenhum relatório gerado ainda'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGerarAgora(config)}
                            disabled={gerando === config.id}
                          >
                            {gerando === config.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                            Gerar agora
                          </Button>
                          {config.ultimoGerado && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copiarTexto(config.id, config.ultimoGerado!.conteudo)}
                              >
                                {copiado === config.id ? (
                                  <CheckCircle2 className="size-4 text-green-600" />
                                ) : (
                                  <Copy className="size-4" />
                                )}
                                {copiado === config.id ? 'Copiado!' : 'Copiar'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setRelatorioAberto(aberto ? null : config.id)}
                                title="Ver relatório"
                              >
                                {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {aberto && config.ultimoGerado && (
                        <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap border-t bg-background px-3 py-3 font-mono text-xs text-muted-foreground">
                          {config.ultimoGerado.conteudo}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Histórico de relatórios gerados */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum relatório gerado ainda — os relatórios configurados aparecem aqui automaticamente na data de envio.
            </p>
          ) : (
            <div className="space-y-2">
              {historico.map((item) => {
                const isExpanded = historicoExpandido === item.id
                return (
                  <div key={item.id} className="rounded-lg border bg-background">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.clienteNome}</span>
                        <Badge variant="outline" className="text-xs">
                          {labelTipoHistorico(item.tipo)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatarDiaMes(item.periodoInicio)} → {formatarDiaMes(item.periodoFim)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          gerado em {formatarDataHoraBr(item.geradoEm)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => copiarTexto(item.id, item.conteudo)}>
                          {copiado === item.id ? (
                            <CheckCircle2 className="size-4 text-green-600" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                          {copiado === item.id ? 'Copiado!' : 'Copiar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoricoExpandido((prev) => (prev === item.id ? null : item.id))}
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          Ver
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t px-4 py-3">
                        <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap font-mono text-sm text-muted-foreground">
                          {item.conteudo}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo Relatório / edição */}
      <NovoRelatorioDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        clientes={clientes}
        configParaEditar={configEmEdicao}
        onSaved={recarregar}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={configParaExcluir !== null} onOpenChange={(open) => !open && setConfigParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório configurado?</AlertDialogTitle>
            <AlertDialogDescription>
              A configuração “{configParaExcluir?.nome}” será excluída. Os relatórios já gerados permanecem no histórico.
              Se quiser apenas interromper a geração, use o botão de pausar — a configuração não é perdida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirConfig}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
