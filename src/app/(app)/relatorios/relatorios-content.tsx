'use client'

import { useState, useTransition } from 'react'
import { FileText, Copy, CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { gerarRelatorio, gerarRelatoriosEmLote, listarClientesRelatorio, type ClienteParaRelatorio } from '@/actions/relatorios'
import type { RelatorioGerado } from '@/lib/relatorios/gerar-relatorio'
import { useEffect } from 'react'

type RelatorioState = {
  clienteId: string
  status: 'pendente' | 'gerando' | 'gerado' | 'erro'
  relatorio?: RelatorioGerado
  erro?: string
}

export function RelatoriosContent() {
  const [clientes, setClientes] = useState<ClienteParaRelatorio[]>([])
  const [relatorios, setRelatorios] = useState<Map<string, RelatorioState>>(new Map())
  const [expandido, setExpandido] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [gerandoTodos, setGerandoTodos] = useState(false)
  const [loaded, setLoaded] = useState(false)

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
  }, [])

  async function handleGerar(clienteId: string) {
    setRelatorios((prev) => {
      const next = new Map(prev)
      next.set(clienteId, { clienteId, status: 'gerando' })
      return next
    })

    const result = await gerarRelatorio(clienteId)

    setRelatorios((prev) => {
      const next = new Map(prev)
      if (result.success) {
        next.set(clienteId, { clienteId, status: 'gerado', relatorio: result.relatorio })
      } else {
        next.set(clienteId, { clienteId, status: 'erro', erro: result.error })
      }
      return next
    })
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

    const result = await gerarRelatoriosEmLote()

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

    setGerandoTodos(false)
  }

  async function handleCopiar(clienteId: string) {
    const state = relatorios.get(clienteId)
    if (!state?.relatorio) return

    await navigator.clipboard.writeText(state.relatorio.textoWhatsapp)
    setCopiado(clienteId)
    setTimeout(() => setCopiado(null), 2000)
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
      {/* Header com ação em lote */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {totalGerados > 0
            ? `${totalGerados} de ${clientes.length} relatórios gerados`
            : `${clientes.length} clientes disponíveis`}
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
                            <pre className="whitespace-pre-wrap text-sm font-mono bg-background rounded-md p-4 border max-h-[500px] overflow-y-auto">
                              {state.relatorio.textoWhatsapp}
                            </pre>
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
    </div>
  )
}
