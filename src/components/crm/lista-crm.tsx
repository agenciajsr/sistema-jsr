'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FichaLead } from '@/components/crm/ficha-lead'
import { nomeOrigem } from '@/lib/crm/origem'
import { rotuloServico } from '@/lib/crm/servicos'
import type { ColunaFechada, ColunaKanban, OportunidadeCard } from '@/lib/crm/dados'

// Visao LISTA da /crm: os mesmos negocios do kanban numa tabela plana,
// respeitando busca/filtros (oportunidadesVisiveis). Clique na linha abre a
// MESMA ficha do lead do kanban.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatarData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

export function ListaCrm({
  colunas,
  colunasFechadas,
  oportunidadesVisiveis,
}: {
  colunas: ColunaKanban[]
  colunasFechadas: ColunaFechada[]
  oportunidadesVisiveis?: Set<string>
}) {
  const [contatoAberto, setContatoAberto] = useState<string | null>(null)

  const etapaPorId = new Map(colunas.map((c) => [c.etapa.id, c.etapa]))

  const linhas: OportunidadeCard[] = [
    ...colunas.flatMap((c) => c.oportunidades),
    ...colunasFechadas.flatMap((c) => c.oportunidades),
  ].filter((o) => (oportunidadesVisiveis ? oportunidadesVisiveis.has(o.id) : true))

  function etiquetaEtapa(o: OportunidadeCard) {
    if (o.status === 'ganha') {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15">Ganho</Badge>
    }
    if (o.status === 'perdida') {
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/15">Perdido</Badge>
    }
    const etapa = etapaPorId.get(o.etapaId)
    return <Badge variant="outline">{etapa?.nome ?? '—'}</Badge>
  }

  return (
    <>
      <Card className="border-none py-0 shadow-sm">
        <CardContent className="p-0">
          {linhas.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum negocio encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Servico</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Atendente</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => o.contatoId && setContatoAberto(o.contatoId)}
                    >
                      <TableCell className="font-medium">
                        {o.contatoNome ?? o.titulo}
                        {o.empresaNome && (
                          <span className="block text-xs text-muted-foreground">
                            {o.empresaNome}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{rotuloServico(o.servico)}</TableCell>
                      <TableCell>{etiquetaEtapa(o)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {o.valor != null ? formatoBRL.format(o.valor) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{nomeOrigem(o.origem)}</TableCell>
                      <TableCell className="text-sm">{o.donoNome ?? 'Sem atendente'}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatarData(o.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FichaLead
        contatoId={contatoAberto}
        onOpenChange={(aberta) => {
          if (!aberta) setContatoAberto(null)
        }}
      />
    </>
  )
}
