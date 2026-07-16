'use client'

// Aba "Cobranças" de /financeiro (quick-260716-sr5): visão consolidada por
// cliente — modo de cobrança, fatura do mês corrente e ações por linha.
// 100% pt-BR; TODO resultado de action vira toast (nada silencioso).

import { useTransition } from 'react'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  cadastrarClienteNoAsaas,
  confirmarRecebimentoManual,
  gerarCobrancaDoMesPorCliente,
  type ResultadoAcaoCobranca,
} from '@/actions/cobrancas'
import type { LinhaVisaoCobrancas } from '@/lib/cobrancas/dados'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

// 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (fuso).
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const MODO_BADGE: Record<string, { label: string; classe: string }> = {
  automatico_asaas: {
    label: 'Asaas',
    classe: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
  },
  manual_pix: {
    label: 'Manual PIX',
    classe: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  },
}

const STATUS_BADGE: Record<string, { label: string; classe: string }> = {
  pendente: {
    label: 'Pendente',
    classe: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  },
  paga: {
    label: 'Paga',
    classe: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
  },
  vencida: {
    label: 'Vencida',
    classe: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  },
  cancelada: {
    label: 'Cancelada',
    classe: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400',
  },
}

export function CobrancasTab({
  linhas,
  asaasConfigurado,
}: {
  linhas: LinhaVisaoCobrancas[]
  asaasConfigurado: boolean
}) {
  const [pendente, startTransition] = useTransition()

  function executar(acao: () => Promise<ResultadoAcaoCobranca>, sucessoPadrao: string) {
    startTransition(async () => {
      const resultado = await acao()
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      if (resultado.aviso) {
        toast.warning(resultado.aviso)
        return
      }
      toast.success(sucessoPadrao)
    })
  }

  return (
    <div className="space-y-3">
      {!asaasConfigurado && (
        <p className="rounded-lg border border-dashed bg-secondary/40 p-3 text-sm text-muted-foreground">
          Asaas não configurado — cobranças são registradas apenas internamente.
        </p>
      )}

      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente ativo na carteira.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Fatura do mês</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => {
                const modo = MODO_BADGE[linha.modo] ?? MODO_BADGE.manual_pix
                const automatico = linha.modo === 'automatico_asaas'
                const fatura = linha.fatura
                const faturaAberta =
                  fatura !== null && (fatura.status === 'pendente' || fatura.status === 'vencida')
                const podeGerar =
                  linha.temContratoVigente &&
                  (fatura === null || (faturaAberta && automatico && !fatura.invoiceUrl))
                return (
                  <TableRow key={linha.clienteId}>
                    <TableCell className="font-medium">{linha.nome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={modo.classe}>
                        {modo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {fatura ? (
                        <Badge
                          variant="secondary"
                          className={(STATUS_BADGE[fatura.status] ?? STATUS_BADGE.pendente).classe}
                        >
                          {(STATUS_BADGE[fatura.status] ?? STATUS_BADGE.pendente).label}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-zinc-200 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-400"
                        >
                          Sem fatura
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {fatura ? formatadorMoeda.format(Number(fatura.valor)) : '—'}
                    </TableCell>
                    <TableCell>{fatura ? formatarData(fatura.vencimento) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!linha.temContratoVigente && !fatura && (
                          <span
                            className="text-sm text-muted-foreground"
                            title="Sem contrato assinado vigente — assine um contrato para gerar cobranças."
                          >
                            —
                          </span>
                        )}
                        {automatico && !linha.asaasCustomerId && asaasConfigurado && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pendente}
                            onClick={() =>
                              executar(
                                () => cadastrarClienteNoAsaas(linha.clienteId),
                                'Cliente cadastrado no Asaas.',
                              )
                            }
                          >
                            Cadastrar no Asaas
                          </Button>
                        )}
                        {podeGerar && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pendente}
                            onClick={() =>
                              executar(
                                () => gerarCobrancaDoMesPorCliente(linha.clienteId),
                                'Cobrança do mês gerada.',
                              )
                            }
                          >
                            Gerar cobrança do mês
                          </Button>
                        )}
                        {fatura?.invoiceUrl && (
                          <Button asChild variant="outline" size="sm">
                            <a href={fatura.invoiceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3.5" />
                              Ver fatura
                            </a>
                          </Button>
                        )}
                        {faturaAberta && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pendente}
                            onClick={() =>
                              executar(
                                () => confirmarRecebimentoManual(fatura!.id),
                                'Recebimento confirmado — fatura quitada.',
                              )
                            }
                          >
                            Quitar (PIX manual)
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
