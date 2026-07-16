'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ClipboardCheck, FileText, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  enviarParaAssinatura,
  atualizarStatusAssinatura,
  type ContratoConsolidado,
} from '@/actions/contratos'
import {
  rotuloStatusFluxo,
  badgeStatusFluxo,
  rotuloTipoDocumento,
} from '@/lib/contratos/fluxo'
import { rotuloServico } from '@/lib/crm/servicos'
import {
  servicosContratadosSchema,
  rotuloPlataformas,
  rotuloServicoUi,
} from '@/lib/contratos/servicos-contratados'
import { CopiarLinkBotao } from '@/components/contratos/copiar-link-botao'
import { VerificarDadosDialog } from '@/components/contratos/verificar-dados-dialog'
import { EditarContratoDialog } from '@/components/contratos/editar-contrato-dialog'
import { ExcluirContratoAlert } from '@/components/contratos/excluir-contrato-alert'

// Tabela de /contratos — colunas na ordem EXATA (decisão LOCKED da Fase 4 +
// coluna Serviços do quick-260716-ky2):
// Cliente | Tipo | Serviços | Valor | Status | Início | Fim | Verificar |
// Enviar/Reenviar | Preview | Editar | Excluir | Selecionar.

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

// 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (fuso).
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

// Badges compactas dos serviços contratados (quick-260716-ky2). Estruturado →
// 1 badge por serviço (tráfego pago com as plataformas no title); legado →
// fallback para o servico único (rotuloServico).
function ServicosBadges({ contrato }: { contrato: ContratoConsolidado }) {
  const parsed = servicosContratadosSchema.safeParse(contrato.servicos)
  if (!parsed.success) {
    return <span className="text-sm text-muted-foreground">{rotuloServico(contrato.servico)}</span>
  }
  return (
    <div className="flex max-w-56 flex-wrap gap-1">
      {parsed.data.map((s) => (
        <Badge
          key={s.servico}
          variant="secondary"
          className="bg-muted text-foreground dark:bg-muted/60"
          title={
            s.servico === 'trafego_pago'
              ? `${rotuloServicoUi(s.servico)} — ${rotuloPlataformas(s.plataformas)}`
              : rotuloServicoUi(s.servico)
          }
        >
          {rotuloServicoUi(s.servico)}
        </Badge>
      ))}
    </div>
  )
}

function BotaoIcone({
  tooltip,
  desabilitado,
  onClick,
  children,
}: {
  tooltip: string
  desabilitado?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span para o tooltip funcionar mesmo com o botão desabilitado */}
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={desabilitado}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function TabelaContratos({ contratos }: { contratos: ContratoConsolidado[] }) {
  const [verificarId, setVerificarId] = useState<string | null>(null)
  const [editarId, setEditarId] = useState<string | null>(null)
  const [excluirId, setExcluirId] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const verificar = contratos.find((c) => c.id === verificarId)
  const editar = contratos.find((c) => c.id === editarId)
  const excluir = contratos.find((c) => c.id === excluirId)

  const todosSelecionados = contratos.length > 0 && selecionados.size === contratos.length

  function alternarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(contratos.map((c) => c.id)))
  }

  function alternarUm(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function enviar(contrato: ContratoConsolidado) {
    setEnviandoId(contrato.id)
    startTransition(async () => {
      const resultado = await enviarParaAssinatura(contrato.id)
      setEnviandoId(null)
      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }
      toast.success(
        contrato.statusFluxo === 'aguardando_assinatura'
          ? 'Contrato reenviado para assinatura.'
          : 'Contrato enviado para assinatura.'
      )
    })
  }

  function atualizarStatus(contrato: ContratoConsolidado) {
    setEnviandoId(contrato.id)
    startTransition(async () => {
      const resultado = await atualizarStatusAssinatura(contrato.id)
      setEnviandoId(null)
      if ('error' in resultado) {
        toast.error(resultado.error)
        return
      }
      toast[resultado.data.assinado ? 'success' : 'info'](
        resultado.data.assinado
          ? 'Contrato assinado — cliente ativado!'
          : 'Ainda aguardando a assinatura.'
      )
    })
  }

  return (
    <div className="space-y-2">
      {selecionados.size > 0 && (
        <p className="text-sm text-muted-foreground">
          {selecionados.size} {selecionados.size === 1 ? 'selecionado' : 'selecionados'}
        </p>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Serviços</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead className="text-center">Verificar</TableHead>
              <TableHead className="text-center">Enviar</TableHead>
              <TableHead className="text-center">Preview</TableHead>
              <TableHead className="text-center">Editar</TableHead>
              <TableHead className="text-center">Excluir</TableHead>
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={todosSelecionados}
                  onCheckedChange={alternarTodos}
                  aria-label="Selecionar todos"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((contrato) => {
              const temDados = Boolean(contrato.dadosContratante)
              const aguardandoAssinatura = contrato.statusFluxo === 'aguardando_assinatura'
              const podeEnviar = contrato.statusFluxo === 'dados_recebidos' || aguardandoAssinatura
              const ocupado = enviandoId === contrato.id

              return (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clientes/${contrato.clienteId}`} className="hover:underline">
                      {contrato.clienteNome}
                    </Link>
                    {!contrato.vigente && (
                      <span className="ml-2 text-xs text-muted-foreground">(anterior)</span>
                    )}
                  </TableCell>
                  <TableCell>{rotuloTipoDocumento(contrato.tipoDocumento)}</TableCell>
                  <TableCell>
                    <ServicosBadges contrato={contrato} />
                  </TableCell>
                  <TableCell>{formatadorMoeda.format(Number(contrato.valorMensal))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge className={badgeStatusFluxo(contrato.statusFluxo)}>
                        {rotuloStatusFluxo(contrato.statusFluxo)}
                      </Badge>
                      {contrato.statusFluxo === 'aguardando_dados' && contrato.token && (
                        <CopiarLinkBotao token={contrato.token} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatarData(contrato.dataInicio)}</TableCell>
                  <TableCell>{formatarData(contrato.dataVencimento)}</TableCell>

                  <TableCell className="text-center">
                    <BotaoIcone
                      tooltip={
                        temDados
                          ? 'Ver os dados enviados pelo contratante'
                          : 'O contratante ainda não enviou os dados'
                      }
                      desabilitado={!temDados}
                      onClick={() => setVerificarId(contrato.id)}
                    >
                      <ClipboardCheck className="size-4" />
                    </BotaoIcone>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="inline-flex items-center">
                      <BotaoIcone
                        tooltip={
                          !contrato.statusFluxo
                            ? 'Contrato manual — sem fluxo de assinatura'
                            : contrato.statusFluxo === 'aguardando_dados'
                              ? 'Aguardando o contratante preencher os dados'
                              : contrato.statusFluxo === 'assinado'
                                ? 'Contrato já assinado'
                                : aguardandoAssinatura
                                  ? 'Reenviar para assinatura (gera novo documento)'
                                  : 'Enviar para assinatura via Autentique'
                        }
                        desabilitado={!podeEnviar || ocupado}
                        onClick={() => enviar(contrato)}
                      >
                        <Send className="size-4" />
                      </BotaoIcone>
                      {aguardandoAssinatura && (
                        <BotaoIcone
                          tooltip="Atualizar status da assinatura (consulta a Autentique)"
                          desabilitado={ocupado}
                          onClick={() => atualizarStatus(contrato)}
                        >
                          <RefreshCw className="size-4" />
                        </BotaoIcone>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    {temDados ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild type="button" variant="ghost" size="sm">
                            <Link href={`/contratos/preview/${contrato.id}`}>
                              <FileText className="size-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver o contrato preenchido</TooltipContent>
                      </Tooltip>
                    ) : (
                      <BotaoIcone
                        tooltip="O contratante ainda não enviou os dados"
                        desabilitado
                      >
                        <FileText className="size-4" />
                      </BotaoIcone>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <BotaoIcone tooltip="Editar contrato" onClick={() => setEditarId(contrato.id)}>
                      <Pencil className="size-4" />
                    </BotaoIcone>
                  </TableCell>

                  <TableCell className="text-center">
                    <BotaoIcone
                      tooltip="Excluir contrato"
                      onClick={() => setExcluirId(contrato.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </BotaoIcone>
                  </TableCell>

                  <TableCell className="text-center">
                    <Checkbox
                      checked={selecionados.has(contrato.id)}
                      onCheckedChange={() => alternarUm(contrato.id)}
                      aria-label={`Selecionar contrato de ${contrato.clienteNome}`}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {verificar && (
        <VerificarDadosDialog
          aberto
          onFechar={() => setVerificarId(null)}
          clienteNome={verificar.clienteNome}
          dadosContratante={verificar.dadosContratante}
          dadosRecebidosEm={verificar.dadosRecebidosEm}
        />
      )}
      {editar && (
        <EditarContratoDialog aberto onFechar={() => setEditarId(null)} contrato={editar} />
      )}
      {excluir && (
        <ExcluirContratoAlert
          aberto
          onFechar={() => setExcluirId(null)}
          contratoId={excluir.id}
          clienteNome={excluir.clienteNome}
        />
      )}
    </div>
  )
}
