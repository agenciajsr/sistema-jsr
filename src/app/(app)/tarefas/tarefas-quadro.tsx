'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { ptBR } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TarefasDoPeriodo } from '@/lib/tarefas/dados'
import {
  PRIORIDADE_LABEL,
  PRIORIDADE_ORDEM,
  type TarefaPrioridade,
} from '@/lib/tarefas/recorrencia'
import {
  COLUNAS_ORDEM,
  COLUNA_LABEL,
  COLUNA_HELPER,
  COLUNA_PONTO,
  COLUNA_BARRA,
  agruparPorStatus,
  estatisticasDoQuadro,
  filtrarTarefas,
  rotuloDoDia,
  tarefasDaVisaoDiaria,
} from '@/lib/tarefas/quadro'
import { TarefaCard } from './tarefa-card'

/** Sentinela: o Radix não aceita SelectItem/valor "". */
const TODOS = 'todos'

/** Rosca de "Conclusão Geral" — SVG inline (D-10). Recharts seria exagero
 *  para um donut de UM valor. */
function RoscaProgresso({ percentual }: { percentual: number }) {
  const raio = 28
  const circunferencia = 2 * Math.PI * raio
  const preenchido = (percentual / 100) * circunferencia

  return (
    <div className="relative size-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={raio}
          fill="none"
          strokeWidth="7"
          className="stroke-muted"
        />
        <circle
          cx="36"
          cy="36"
          r={raio}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${circunferencia}`}
          className="stroke-chart-success"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {percentual}%
      </span>
    </div>
  )
}

export function TarefasQuadro({
  dados,
  clientes,
  responsaveis,
}: {
  dados: TarefasDoPeriodo
  clientes: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
}) {
  const router = useRouter()

  const [busca, setBusca] = useState('')
  const [prioridade, setPrioridade] = useState<TarefaPrioridade | 'todas'>('todas')
  const [clienteId, setClienteId] = useState<string>(TODOS)
  const [responsavelId, setResponsavelId] = useState<string>(TODOS)
  const [calendarioAberto, setCalendarioAberto] = useState(false)

  // Toda a derivação vem do módulo PURO — zero lógica solta aqui (D-05).
  // Visão DIÁRIA primeiro (ibf): só o que pertence ao dia visualizado entra.
  const doDia = useMemo(
    () => tarefasDaVisaoDiaria(dados.tarefas, dados.dia),
    [dados.tarefas, dados.dia]
  )
  const visiveis = useMemo(
    () => filtrarTarefas(doDia, { busca, prioridade, clienteId, responsavelId }),
    [doDia, busca, prioridade, clienteId, responsavelId]
  )
  const colunas = useMemo(() => agruparPorStatus(visiveis), [visiveis])
  const stats = useMemo(() => estatisticasDoQuadro(visiveis), [visiveis])

  const filtrosAtivos = (clienteId !== TODOS ? 1 : 0) + (responsavelId !== TODOS ? 1 : 0)
  const ehHoje = dados.dia === dados.hoje

  // Date LOCAL a partir de 'YYYY-MM-DD' — nunca new Date(string), que
  // interpretaria como UTC e cairia no dia vizinho (regra de fuso do projeto).
  const diaSelecionado = useMemo(() => {
    const [ano, mes, diaNum] = dados.dia.split('-').map(Number)
    return new Date(ano, mes - 1, diaNum)
  }, [dados.dia])

  function escolherDia(data: Date | undefined) {
    if (!data) return
    // Ano/mês/dia LOCAIS do objeto — nunca toISOString (fuso do projeto).
    const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
      data.getDate()
    ).padStart(2, '0')}`
    setCalendarioAberto(false)
    router.push(iso === dados.hoje ? '/tarefas' : `/tarefas?dia=${iso}`)
  }

  const vazio = doDia.length === 0

  return (
    // D-01: container flex com min-h da viewport (header h-16 + p-6/8 do <main>).
    // A área do meio ganha flex-1 e empurra a barra de stats para o rodapé — sem
    // isso, com 1 tarefa só, a barra ficaria "lá em cima" (o bug relatado).
    <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-4 lg:min-h-[calc(100svh-8rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ListChecks className="mt-1 size-6 text-muted-foreground" />
          <div>
            <h1 className="text-[28px] leading-tight font-semibold">Tarefas</h1>
            {/* Não existe componente breadcrumb no repo — markup simples. */}
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              <ChevronRight className="size-3" />
              <span>Tarefas</span>
            </div>
          </div>
        </div>

        <Button asChild>
          <Link href={`/tarefas/nova?data=${dados.dia}`}>
            <Plus className="size-4" />
            Nova Tarefa
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
            aria-label="Buscar tarefa pelo titulo"
          />
        </div>

        {/* UM botão de dia (ibf): rótulo 'Hoje' ou a data; calendário popover. */}
        <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
          <PopoverTrigger asChild>
            <Button variant="outline" aria-label="Escolher dia do quadro">
              <CalendarIcon className="size-4" />
              {rotuloDoDia(dados.dia, dados.hoje)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={diaSelecionado}
              defaultMonth={diaSelecionado}
              onSelect={escolherDia}
            />
            {!ehHoje && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setCalendarioAberto(false)
                    router.push('/tarefas')
                  }}
                >
                  Voltar para hoje
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Select
          value={prioridade}
          onValueChange={(v) => setPrioridade(v as TarefaPrioridade | 'todas')}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as prioridades</SelectItem>
            {PRIORIDADE_ORDEM.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORIDADE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* D-07: "Filtros" é real — cliente, responsável e limpar. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="size-4" />
              Filtros
              {filtrosAtivos > 0 && (
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {filtrosAtivos}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Cliente</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setClienteId(TODOS)}>
              Todos os clientes
            </DropdownMenuItem>
            {clientes.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setClienteId(c.id)}>
                {c.nome}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Responsável</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setResponsavelId(TODOS)}>
              Todos os responsáveis
            </DropdownMenuItem>
            {responsaveis.map((r) => (
              <DropdownMenuItem key={r.id} onClick={() => setResponsavelId(r.id)}>
                {r.nome}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setClienteId(TODOS)
                setResponsavelId(TODOS)
              }}
            >
              Limpar filtros
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Estado vazio: cabeçalho e toolbar continuam visíveis — o usuário
          precisa poder trocar o intervalo para achar as tarefas. */}
      {vazio ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-[20px] leading-tight font-semibold">Nenhuma tarefa neste período</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Ajuste o intervalo de datas acima ou crie a primeira tarefa deste período.
          </p>
          <Button asChild>
            <Link href={`/tarefas/nova?data=${dados.dia}`}>
              <Plus className="size-4" />
              Nova Tarefa
            </Link>
          </Button>
        </div>
      ) : (
        // O quadro: 4 colunas em xl; rolagem horizontal abaixo disso. flex-1
        // absorve a sobra e empurra a barra de stats para o rodapé (D-01).
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
            {COLUNAS_ORDEM.map((s) => (
              <div key={s} className="w-[300px] shrink-0 xl:w-auto xl:flex-1 xl:shrink">
                <div className={`h-1 rounded-full ${COLUNA_BARRA[s]}`} />

                <div className="flex items-center gap-2 py-3">
                  <span className={`size-2 rounded-full ${COLUNA_PONTO[s]}`} />
                  <span className="text-sm font-semibold">{COLUNA_LABEL[s]}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {colunas[s].length}
                  </span>
                </div>

                <div className="space-y-2">
                  {colunas[s].map((t) => (
                    <TarefaCard key={t.id} tarefa={t} />
                  ))}
                </div>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start text-muted-foreground"
                >
                  <Link href={`/tarefas/nova?status=${s}&data=${dados.dia}`}>
                    <Plus className="size-4" />
                    Adicionar tarefa
                  </Link>
                </Button>
              </div>
            ))}
          </div>
      )}

      {/* Barra de estatísticas COLADA no rodapé da viewport (D-01). Sempre
          renderizada — com 1 tarefa ou 50 fica embaixo e o quadro rola atrás
          (backdrop-blur, mesmo tratamento do header sticky do layout). Reflete
          o que está visível pós-filtro (D-06). */}
      <Card className="sticky bottom-0 z-20 mt-auto -mx-6 -mb-6 rounded-none border-x-0 border-b-0 border-t bg-card/95 px-6 py-3 backdrop-blur-md lg:-mx-8 lg:-mb-8 lg:px-8">
        <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Tarefas</p>
                <p className="text-xs text-muted-foreground">Esta semana</p>
              </div>

              {COLUNAS_ORDEM.map((s) => (
                <div key={s}>
                  <p className="text-2xl font-semibold tabular-nums">{stats.porStatus[s]}</p>
                  <p className="text-xs text-muted-foreground">{COLUNA_LABEL[s]}</p>
                  <p className="text-xs text-muted-foreground">{COLUNA_HELPER[s]}</p>
                </div>
              ))}

              <div className="flex items-center gap-3 lg:ml-auto">
                <RoscaProgresso percentual={stats.percentualConclusao} />
                <div>
                  <p className="text-sm font-medium">Conclusão Geral</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.percentualConclusao >= 70
                      ? 'Ótimo progresso!'
                      : stats.percentualConclusao >= 30
                        ? 'Seguindo bem.'
                        : 'Vamos começar.'}
                  </p>
                </div>
              </div>
            </div>
      </Card>
    </div>
  )
}
