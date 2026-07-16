'use client'

// Aba "Faturas" da ficha do cliente (Fase 5 Parte 1 — tabela cobrancas).
// 100% pt-BR, badges pastel com variantes dark: (memória do projeto).

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
import { confirmarRecebimentoManual, setModoCobranca } from '@/actions/cobrancas'
import type { FaturaCliente } from '@/lib/cobrancas/dados'

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

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

// 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (fuso).
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

// 'YYYY-MM' → 'MM/YYYY'.
function formatarCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
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

const QUITACAO_LABEL: Record<string, string> = {
  asaas: 'Asaas',
  pix_manual: 'PIX manual',
}

export function FaturasCliente({
  clienteId,
  modoCobranca,
  faturas,
  asaasConfigurado,
}: {
  clienteId: string
  modoCobranca: string
  faturas: FaturaCliente[]
  asaasConfigurado: boolean
}) {
  const [pendente, startTransition] = useTransition()

  function alterarModo(novoModo: 'automatico_asaas' | 'manual_pix') {
    if (novoModo === modoCobranca) return
    startTransition(async () => {
      const resultado = await setModoCobranca(clienteId, novoModo)
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      toast.success(resultado.aviso ?? 'Modo de cobrança atualizado.')
    })
  }

  function confirmarRecebimento(fatura: FaturaCliente) {
    const confirmou = window.confirm(
      `Confirmar o recebimento da fatura de ${formatarCompetencia(fatura.competencia)} (${formatadorMoeda.format(Number(fatura.valor))}) via PIX manual?`,
    )
    if (!confirmou) return
    startTransition(async () => {
      const resultado = await confirmarRecebimentoManual(fatura.id)
      if (!resultado.ok) {
        toast.error(resultado.erro)
        return
      }
      if (resultado.aviso) {
        toast.warning(resultado.aviso)
        return
      }
      toast.success('Recebimento confirmado — fatura quitada.')
    })
  }

  const badgeModo = MODO_BADGE[modoCobranca] ?? MODO_BADGE.manual_pix

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <span className="text-sm font-medium">Modo de cobrança:</span>
        <Badge variant="secondary" className={badgeModo.classe}>
          {badgeModo.label}
        </Badge>
        <select
          value={modoCobranca === 'automatico_asaas' ? 'automatico_asaas' : 'manual_pix'}
          disabled={pendente}
          onChange={(e) => alterarModo(e.target.value as 'automatico_asaas' | 'manual_pix')}
          className="ml-auto flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Alterar modo de cobrança"
        >
          <option value="manual_pix">Manual via PIX (direto na chave)</option>
          <option value="automatico_asaas">Automático via Asaas (boleto/link)</option>
        </select>
      </div>

      {!asaasConfigurado && (
        <p className="rounded-lg border border-dashed bg-secondary/40 p-3 text-sm text-muted-foreground">
          Asaas não configurado — faturas são registradas apenas internamente.
        </p>
      )}

      {faturas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fatura gerada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Quitação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.map((fatura) => {
                const badge = STATUS_BADGE[fatura.status] ?? STATUS_BADGE.pendente
                const emAberto = fatura.status === 'pendente' || fatura.status === 'vencida'
                return (
                  <TableRow key={fatura.id}>
                    <TableCell className="font-medium">
                      {formatarCompetencia(fatura.competencia)}
                    </TableCell>
                    <TableCell>{formatadorMoeda.format(Number(fatura.valor))}</TableCell>
                    <TableCell>{formatarData(fatura.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badge.classe}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fatura.criadoVia === 'manual' ? 'Manual' : 'Automática'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fatura.formaQuitacao ? QUITACAO_LABEL[fatura.formaQuitacao] ?? fatura.formaQuitacao : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {fatura.invoiceUrl && (
                          <Button asChild variant="outline" size="sm">
                            <a href={fatura.invoiceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3.5" />
                              Ver fatura
                            </a>
                          </Button>
                        )}
                        {emAberto && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pendente}
                            onClick={() => confirmarRecebimento(fatura)}
                          >
                            Confirmar recebimento (PIX manual)
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
