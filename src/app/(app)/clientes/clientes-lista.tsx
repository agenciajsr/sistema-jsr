'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, MoreHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  filtrarClientes,
  contarPorStatus,
  STATUS_ORDEM,
  STATUS_LABEL,
  type ClienteLinha,
  type ClienteStatus,
} from '@/lib/clientes/agregar'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

// Rótulo SINGULAR para o badge da linha — o plural fica só nas abas.
const STATUS_BADGE_LABEL: Record<ClienteStatus, string> = {
  ativo: 'Ativo',
  aguardando_inicio: 'Aguardando Início',
  em_aviso: 'Em Aviso',
  pausado: 'Pausado',
  encerrado: 'Inativo',
}

// Cores semânticas já definidas em globals.css.
const STATUS_BADGE_CLASSE: Record<ClienteStatus, string> = {
  ativo: 'bg-chart-success text-white',
  aguardando_inicio: 'bg-primary text-primary-foreground',
  em_aviso: 'bg-chart-warning text-white',
  pausado: 'bg-muted text-muted-foreground',
  encerrado: '',
}

export function ClientesLista({ clientes }: { clientes: ClienteLinha[] }) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<ClienteStatus | 'todos'>('ativo')

  const contagens = useMemo(() => contarPorStatus(clientes), [clientes])
  const visiveis = useMemo(
    () => filtrarClientes(clientes, { busca, aba }),
    [clientes, busca, aba]
  )

  // Carteira vazia: nada de busca/abas, só o convite para cadastrar.
  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-[20px] leading-tight font-semibold">
          Nenhum cliente cadastrado ainda
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Cadastre seu primeiro cliente para começar a acompanhar contratos e status.
        </p>
        <Button asChild>
          <Link href="/clientes/novo">Cadastrar Cliente</Link>
        </Button>
      </div>
    )
  }

  function abrirCliente(id: string) {
    router.push(`/clientes/${id}`)
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
          aria-label="Buscar cliente pelo nome"
        />
      </div>

      {/* A tabela é renderizada UMA vez abaixo do TabsList — a lista já vem
          filtrada por `aba`, não há por que duplicá-la em 6 TabsContent. */}
      <Tabs value={aba} onValueChange={(v) => setAba(v as ClienteStatus | 'todos')}>
        <TabsList>
          {STATUS_ORDEM.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABEL[s]} ({contagens[s]})
            </TabsTrigger>
          ))}
          <TabsTrigger value="todos">Todos ({contagens.todos})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-0">
        {visiveis.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado com esses filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Alertas</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                  <TableHead className="text-right">LT</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                  <TableHead className="text-right">Invest. (30d)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((c) => (
                  <TableRow
                    key={c.id}
                    onClick={() => abrirCliente(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') abrirCliente(c.id)
                    }}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {c.nome}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === 'encerrado' ? 'destructive' : 'default'}
                        className={STATUS_BADGE_CLASSE[c.status]}
                      >
                        {STATUS_BADGE_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.alertasAbertos > 0 ? (
                        <span className="font-medium text-destructive">{c.alertasAbertos}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{c.responsavelNome ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(c.mensalidade)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.ltDias}d</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(c.ltv)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatadorMoeda.format(c.investimento30d)}
                    </TableCell>
                    {/* stopPropagation: o ⋯ não pode disparar a navegação da linha. */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Ações de ${c.nome}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/clientes/${c.id}/editar`)}
                          >
                            Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
