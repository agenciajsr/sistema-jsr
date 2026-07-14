'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { FileText, Copy, CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  gerarRelatorio,
  gerarRelatoriosEmLote,
  listarClientesRelatorio,
  listarHistoricoRelatorios,
  type ClienteParaRelatorio,
  type RelatorioHistorico,
} from '@/actions/relatorios'
import type { RelatorioGerado } from '@/lib/relatorios/gerar-relatorio'

type RelatorioState = {
  clienteId: string
  status: 'pendente' | 'gerando' | 'gerado' | 'erro'
  relatorio?: RelatorioGerado
  erro?: string
}

/** Retorna a última segunda-feira e o último domingo (semana anterior). */
function getDefaultPeriod(): { inicio: string; fim: string } {
  const hoje = new Date()
  const diaSemana = hoje.getDay() // 0=dom, 1=seg, ...
  // Último domingo
  const ultimoDomingo = new Date(hoje)
  ultimoDomingo.setDate(hoje.getDate() - (diaSemana === 0 ? 7 : diaSemana))
  // Última segunda
  const ultimaSegunda = new Date(ultimoDomingo)
  ultimaSegunda.setDate(ultimoDomingo.getDate() - 6)

  return {
    inicio: ultimaSegunda.toISOString().slice(0, 10),
    fim: ultimoDomingo.toISOString().slice(0, 10),
  }
}

/** Formata 'YYYY-MM-DD' como 'dd/mm'. */
function formatarDiaMes(data: string): string {
  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}

/** Formata um timestamp ISO como data/hora pt-BR (fuso de Brasília). */
function formatarDataHoraBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function RelatoriosContent() {
  const [clientes, setClientes] = useState<ClienteParaRelatorio[]>([])
  const [relatorios, setRelatorios] = useState<Map<string, RelatorioState>>(new Map())
  const [expandido, setExpandido] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [gerandoTodos, setGerandoTodos] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Período de datas
  const defaultPeriod = getDefaultPeriod()
  const [dataInicio, setDataInicio] = useState(defaultPeriod.inicio)
  const [dataFim, setDataFim] = useState(defaultPeriod.fim)

  // Textos editáveis por cliente (para edição antes de copiar)
  const [textosEditados, setTextosEditados] = useState<Map<string, string>>(new Map())

  // Histórico de relatórios salvos (cron semanal + gerações manuais)
  const [historico, setHistorico] = useState<RelatorioHistorico[]>([])
  const [historicoExpandido, setHistoricoExpandido] = useState<string | null>(null)

  useEffect(() => {
    listarClientesRelatorio().then((data) => {
      setClientes(data)
      const map = new Map<string, RelatorioState>()
      for (const c of data) {
        map.set(c.id, { clienteId: c.id, status: 'pendente' })
      }
      setRelatorios(map)
      setLoaded(true)
    })
    // Carregar o histórico em paralelo (falha não bloqueia o fluxo manual)
    listarHistoricoRelatorios().then(setHistorico).catch(() => setHistorico([]))
  }, [])

  function recarregarHistorico() {
    listarHistoricoRelatorios().then(setHistorico).catch(() => {})
  }

  async function handleGerar(clienteId: string) {
    setRelatorios((prev) => {
      const next = new Map(prev)
      next.set(clienteId, { clienteId, status: 'gerando' })
      return next
    })

    const result = await gerarRelatorio(clienteId, dataInicio, dataFim)

    setRelatorios((prev) => {
      const next = new Map(prev)
      if (result.success) {
        next.set(clienteId, { clienteId, status: 'gerado', relatorio: result.relatorio })
        // Inicializar texto editável com o texto gerado
        setTextosEditados((prev) => {
          const next = new Map(prev)
          next.set(clienteId, result.relatorio.textoWhatsapp)
          return next
        })
      } else {
        next.set(clienteId, { clienteId, status: 'erro', erro: result.error })
      }
      return next
    })

    // Geração manual também alimenta o histórico
    if (result.success) recarregarHistorico()
  }

  async function handleGerarTodos() {
    setGerandoTodos(true)

    // Marcar todos como gerando
    setRelatorios((prev) => {
      const next = new Map(prev)
      for (const c of clientes) {
        next.set(c.id, { clienteId: c.id, status: 'gerando' })
      }
      return next
    })

    const result = await gerarRelatoriosEmLote(dataInicio, dataFim)

    setRelatorios((prev) => {
      const next = new Map(prev)
      for (const r of result.gerados) {
        next.set(r.clienteId, { clienteId: r.clienteId, status: 'gerado', relatorio: r })
      }
      for (const e of result.erros) {
        next.set(e.clienteId, { clienteId: e.clienteId, status: 'erro', erro: e.error })
      }
      return next
    })

    // Inicializar textos editáveis para todos os gerados
    setTextosEditados((prev) => {
      const next = new Map(prev)
      for (const r of result.gerados) {
        next.set(r.clienteId, r.textoWhatsapp)
      }
      return next
    })

    setGerandoTodos(false)

    // Geração em lote também alimenta o histórico
    if (result.gerados.length > 0) recarregarHistorico()
  }

  async function handleCopiar(clienteId: string) {
    const texto = textosEditados.get(clienteId)
    if (!texto) return

    await navigator.clipboard.writeText(texto)
    setCopiado(clienteId)
    setTimeout(() => setCopiado(null), 2000)
  }

  async function handleCopiarHistorico(item: RelatorioHistorico) {
    await navigator.clipboard.writeText(item.conteudo)
    setCopiado(item.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  function handleRestaurarOriginal(clienteId: string) {
    const state = relatorios.get(clienteId)
    if (!state?.relatorio) return
    setTextosEditados((prev) => {
      const next = new Map(prev)
      next.set(clienteId, state.relatorio!.textoWhatsapp)
      return next
    })
  }

  function handleTextoChange(clienteId: string, valor: string) {
    setTextosEditados((prev) => {
      const next = new Map(prev)
      next.set(clienteId, valor)
      return next
    })
  }

  function toggleExpandir(clienteId: string) {
    setExpandido((prev) => (prev === clienteId ? null : clienteId))
  }

  if (!loaded) {
    return <div className="text-sm text-muted-foreground">Carregando clientes...</div>
  }

  if (clientes.length === 0) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum cliente com conta Meta ativa encontrado.
        </CardContent>
      </Card>
    )
  }

  const totalGerados = Array.from(relatorios.values()).filter((r) => r.status === 'gerado').length

  return (
    <div className="space-y-4">
      {/* Período + ação em lote */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="data-inicio" className="text-xs text-muted-foreground">De</Label>
            <Input
              id="data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-[150px] h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="data-fim" className="text-xs text-muted-foreground">Até</Label>
            <Input
              id="data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-[150px] h-9"
            />
          </div>
          <div className="text-sm text-muted-foreground pb-1">
            {totalGerados > 0
              ? `${totalGerados} de ${clientes.length} gerados`
              : `${clientes.length} clientes`}
          </div>
        </div>
        <Button
          onClick={handleGerarTodos}
          disabled={gerandoTodos}
          size="sm"
        >
          {gerandoTodos ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {gerandoTodos ? 'Gerando...' : 'Gerar Todos'}
        </Button>
      </div>

      {/* Tabela de clientes */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Contas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => {
                const state = relatorios.get(cliente.id)
                const isExpanded = expandido === cliente.id

                return (
                  <>
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cliente.objetivoPrincipal ?? cliente.nicho}
                        </Badge>
                      </TableCell>
                      <TableCell>{cliente.totalContas}</TableCell>
                      <TableCell>
                        {state?.status === 'gerado' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Gerado
                          </Badge>
                        )}
                        {state?.status === 'gerando' && (
                          <Badge variant="outline">
                            <Loader2 className="size-3 animate-spin mr-1" />
                            Gerando...
                          </Badge>
                        )}
                        {state?.status === 'erro' && (
                          <Badge variant="destructive">{state.erro}</Badge>
                        )}
                        {state?.status === 'pendente' && (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {state?.status !== 'gerado' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGerar(cliente.id)}
                            disabled={state?.status === 'gerando'}
                          >
                            {state?.status === 'gerando' ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <FileText className="size-4" />
                            )}
                            Gerar
                          </Button>
                        )}
                        {state?.status === 'gerado' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopiar(cliente.id)}
                            >
                              {copiado === cliente.id ? (
                                <CheckCircle2 className="size-4 text-green-600" />
                              ) : (
                                <Copy className="size-4" />
                              )}
                              {copiado === cliente.id ? 'Copiado!' : 'Copiar'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandir(cliente.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                              Ver
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                    {/* Preview expandido */}
                    {isExpanded && state?.relatorio && (
                      <TableRow key={`${cliente.id}-preview`}>
                        <TableCell colSpan={5} className="bg-muted/50 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Período: {state.relatorio.periodoInicio} a {state.relatorio.periodoFim} |{' '}
                                {state.relatorio.totalContas} conta(s) | {state.relatorio.totalCampanhas} campanhas
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestaurarOriginal(cliente.id)}
                                  disabled={textosEditados.get(cliente.id) === state.relatorio.textoWhatsapp}
                                >
                                  <RotateCcw className="size-4" />
                                  Restaurar original
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopiar(cliente.id)}
                                >
                                  {copiado === cliente.id ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                  ) : (
                                    <Copy className="size-4" />
                                  )}
                                  {copiado === cliente.id ? 'Copiado!' : 'Copiar para WhatsApp'}
                                </Button>
                              </div>
                            </div>
                            <Textarea
                              value={textosEditados.get(cliente.id) ?? state.relatorio.textoWhatsapp}
                              onChange={(e) => handleTextoChange(cliente.id, e.target.value)}
                              className="min-h-[300px] max-h-[500px] font-mono text-sm resize-y bg-background"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Histórico de relatórios salvos (cron semanal + gerações manuais) */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum relatório salvo ainda — os relatórios de segunda-feira aparecem aqui automaticamente.
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
                          {item.tipo === 'semanal' ? 'Semanal' : 'Manual'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatarDiaMes(item.periodoInicio)} → {formatarDiaMes(item.periodoFim)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          gerado em {formatarDataHoraBr(item.geradoEm)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarHistorico(item)}
                        >
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
                          onClick={() =>
                            setHistoricoExpandido((prev) => (prev === item.id ? null : item.id))
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
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
    </div>
  )
}
