'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { avancarFollowup, moverParaPerdido } from '@/actions/crm'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CardOportunidade } from '@/components/crm/card-oportunidade'
import { FichaLead } from '@/components/crm/ficha-lead'
import { MotivoPerdaDialog } from '@/components/crm/motivo-perda-dialog'
import { PRAZOS_FOLLOWUP_HORAS, ehEtapaAbordado, ehEtapaFollowup } from '@/lib/crm/followup'
import { ehPipelineFrio } from '@/lib/crm/roteamento'
import type { ColunaFechada, ColunaKanban, OportunidadeCard } from '@/lib/crm/dados'

// Visão Kanban de FOLLOW-UP (quick-260719-s3a): 7 colunas fixas D1..D6 +
// Perdido sobre o MESMO card do kanban de vendas — a coluna deriva de
// followup_nivel, NUNCA há clone/duplicação (decisão explícita do usuário
// contra o modelo do CRM antigo dele).
//
// Regras de arrasto:
//  - só é permitido soltar em D(nivel+1) (adjacente à frente) → avancarFollowup;
//  - soltar em Perdido reusa o fluxo de motivo de perda (MotivoPerdaDialog +
//    moverParaPerdido, mesmos do kanban-crm) — cancelar NÃO move;
//  - qualquer outro destino = no-op.
// "Perdido" é a coluna virtual FIXA existente (status perdida) — nunca etapa.

const PERDIDO = 'perdido'
const NIVEIS = [1, 2, 3, 4, 5, 6] as const

/** Rótulo do prazo no cabeçalho, derivado de PRAZOS_FOLLOWUP_HORAS (sem hardcode duplicado). */
function rotuloPrazo(nivel: number): string {
  if (nivel >= 6) return 'final'
  const horas = PRAZOS_FOLLOWUP_HORAS[nivel]
  return horas < 120 ? `${horas}h` : `${Math.round(horas / 24)}d`
}

/**
 * Cabeçalho da coluna. O NÚMERO significa "quantos follow-ups já foram feitos":
 * nível 0 (só no frio) = lead que recebeu apenas a 1ª mensagem, aguardando o 1º
 * follow-up (24h); D1 = 1º follow-up feito, D2 = 2º, etc. O prazo é o tempo até
 * o PRÓXIMO follow-up a partir daquele ponto.
 */
function tituloColuna(nivel: number): { titulo: string; prazo: string } {
  if (nivel === 0) return { titulo: 'Aguardando 1º follow-up', prazo: '24h' }
  return { titulo: `D${nivel}`, prazo: rotuloPrazo(nivel) }
}

function Coluna({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full w-72 shrink-0 flex-col gap-3 rounded-lg transition-colors',
        isOver && 'bg-muted/60 ring-2 ring-primary/30',
      )}
    >
      {children}
    </div>
  )
}

export function KanbanFollowup({
  colunas,
  colunasFechadas,
  pipelineNome,
  oportunidadesVisiveis,
  onArrastandoChange,
}: {
  colunas: ColunaKanban[]
  colunasFechadas: ColunaFechada[]
  // Nome do pipeline ativo: no funil frio a cadência corre em "Abordado" (não há
  // etapa "Follow-up"), então a coluna-fonte muda conforme este nome.
  pipelineNome?: string | null
  // Filtro da busca do CrmView: quando presente, só renderiza ids do Set.
  oportunidadesVisiveis?: Set<string>
  // Pausa o polling de quase tempo real durante o drag (quick 260717-pvr).
  onArrastandoChange?: (ativo: boolean) => void
}) {
  const router = useRouter()
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [contatoAberto, setContatoAberto] = useState<string | null>(null)
  const [pendentePerda, setPendentePerda] = useState<{ id: string; nome: string } | null>(null)
  // Sobreposição otimista: id → nível LOCAL enquanto o refresh não chega.
  const [niveisOtimistas, setNiveisOtimistas] = useState<Record<string, number>>({})

  // A coluna-fonte da cadência é detectada por NOME (etapas não têm chave
  // semântica): no Vendas é "Follow-up"; no funil frio, "Abordado" (onde a mesma
  // cadência D1-D6 corre — não há etapa "Follow-up"). Se a etapa não existe →
  // estado vazio honesto, sem dado falso.
  const frio = ehPipelineFrio(pipelineNome ?? null)
  const colunaFollowup = colunas.find((c) =>
    frio ? ehEtapaAbordado(c.etapa.nome) : ehEtapaFollowup(c.etapa.nome),
  )
  const cardsFollowup = colunaFollowup?.oportunidades ?? []

  const colunaPerdido = colunasFechadas.find((c) => c.chave === PERDIDO)

  // No frio existe a coluna 0 = "Aguardando 1º follow-up" (lead que recebeu só a
  // 1ª mensagem, nenhum follow-up feito). No Vendas mantém D1..D6 (o card já entra
  // em D1 ao mover para a etapa "Follow-up"). Assim o NÚMERO da coluna significa
  // "quantos follow-ups já foram feitos" — a lógica que o usuário espera.
  const nivelMin = frio ? 0 : 1
  const colunasNivel: number[] = frio ? [0, 1, 2, 3, 4, 5, 6] : [...NIVEIS]

  // Agrupa por nível (com sobreposição otimista). No frio, nível null = aguardando
  // (coluna 0); no Vendas, null cai em D1 (segurança — o card entra com nível 1).
  const porNivel = new Map<number, OportunidadeCard[]>()
  for (const n of colunasNivel) porNivel.set(n, [])
  for (const card of cardsFollowup) {
    const nivel = niveisOtimistas[card.id] ?? card.followupNivel ?? nivelMin
    const alvo = Math.min(Math.max(nivel, nivelMin), 6)
    porNivel.get(alvo)!.push(card)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const filtrando = oportunidadesVisiveis != null
  function filtrar(cards: OportunidadeCard[]) {
    return oportunidadesVisiveis ? cards.filter((o) => oportunidadesVisiveis.has(o.id)) : cards
  }

  function acharCard(id: string): OportunidadeCard | null {
    return (
      cardsFollowup.find((c) => c.id === id) ??
      colunaPerdido?.oportunidades.find((c) => c.id === id) ??
      null
    )
  }

  function onDragStart(event: DragStartEvent) {
    setArrastandoId(String(event.active.id))
    onArrastandoChange?.(true)
  }

  async function onDragEnd(event: DragEndEvent) {
    setArrastandoId(null)
    onArrastandoChange?.(false)
    const { active, over } = event
    if (!over) return

    const id = String(active.id)
    const destino = String(over.id)
    const card = cardsFollowup.find((c) => c.id === id)
    if (!card) return // só cards das colunas D avançam/perdem

    const nivelAtual = niveisOtimistas[id] ?? card.followupNivel ?? nivelMin

    // Perdido: reusa o fluxo de motivo de perda — nada move antes de confirmar.
    if (destino === PERDIDO) {
      setPendentePerda({ id, nome: card.titulo })
      return
    }

    // Só o adjacente à frente: D(n) → D(n+1). Qualquer outro destino = no-op.
    const nivelDestino = Number(destino.replace('nivel-', ''))
    if (!Number.isInteger(nivelDestino) || nivelDestino !== nivelAtual + 1) return

    // Otimista: pinta o card na nova coluna e chama a action; rollback em erro.
    setNiveisOtimistas((prev) => ({ ...prev, [id]: nivelDestino }))
    const result = await avancarFollowup(id)
    if ('error' in result && result.error) {
      setNiveisOtimistas((prev) => {
        const resto = { ...prev }
        delete resto[id]
        return resto
      })
      toast.error(result.error)
      return
    }
    toast.success(`${nivelDestino}º follow-up registrado.`)
    router.refresh()
  }

  // Efetiva a perda DEPOIS do motivo confirmado (mesmo contrato do kanban-crm).
  async function confirmarPerda(motivo: string) {
    if (!pendentePerda) return
    const { id } = pendentePerda
    const result = await moverParaPerdido(id, motivo)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Negocio marcado como perdido.')
    router.refresh()
  }

  const cardArrastado = arrastandoId ? acharCard(arrastandoId) : null

  // Estado vazio honesto: etapa inexistente ou vazia. Copy muda no funil frio,
  // onde a cadência corre em "Abordado".
  if (!colunaFollowup || cardsFollowup.length === 0) {
    const etapaCadencia = frio ? 'Abordado' : 'Follow-up'
    return (
      <div className="rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-sm font-medium">Nenhum lead na etapa {etapaCadencia}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {colunaFollowup
            ? frio
              ? 'Arraste um card para a etapa "Abordado" no funil frio para iniciar a cadência de follow-up.'
              : 'Arraste um card para a etapa "Follow-up" no kanban de vendas para ele entrar em D1.'
            : frio
              ? 'A etapa "Abordado" ainda não existe neste funil — aplique o seed da Prospecção Fria.'
              : 'A etapa "Follow-up" ainda não existe neste pipeline — aplique a migration 0037 para criá-la.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setArrastandoId(null)
          onArrastandoChange?.(false)
        }}
      >
        <div className="flex h-[calc(100dvh-230px)] min-h-[540px] gap-4 overflow-x-auto overflow-y-hidden pb-2">
          {/* Colunas derivadas do followup_nivel do MESMO card. No frio, a coluna 0
              é "Aguardando 1º follow-up"; nas duas o número = follow-ups já feitos. */}
          {colunasNivel.map((nivel) => {
            const cards = porNivel.get(nivel) ?? []
            const visiveis = filtrar(cards)
            const aguardando = nivel === 0
            const { titulo, prazo } = tituloColuna(nivel)
            return (
              <Coluna key={nivel} id={`nivel-${nivel}`}>
                <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-sm)]">
                  <div
                    className={cn(
                      'h-1 w-full',
                      aguardando ? 'bg-sky-400 dark:bg-sky-500' : 'bg-amber-400 dark:bg-amber-500',
                    )}
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <p className={cn('text-sm font-semibold', !aguardando && 'truncate')}>
                      {titulo}
                      <span className="ml-1 font-normal text-muted-foreground">· {prazo}</span>
                    </p>
                    <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
                      {cards.length}
                    </Badge>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                  {visiveis.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      {filtrando && cards.length > 0 ? 'Nada encontrado' : 'Sem negocios'}
                    </p>
                  ) : (
                    visiveis.map((oportunidade) => (
                      <div key={oportunidade.id} data-kanban-card>
                        <CardOportunidade
                          oportunidade={oportunidade}
                          onAbrirFicha={setContatoAberto}
                          arrastando={arrastandoId === oportunidade.id}
                        />
                      </div>
                    ))
                  )}
                </div>
              </Coluna>
            )
          })}

          {/* Perdido: a coluna virtual FIXA existente (status perdida). */}
          {colunaPerdido && (
            <Coluna id={PERDIDO}>
              <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-sm)]">
                <div className="h-1 w-full bg-red-500" />
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-red-600 dark:text-red-400">
                    <XCircle className="size-3.5 shrink-0" />
                    {colunaPerdido.nome}
                  </p>
                  <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
                    {colunaPerdido.total}
                  </Badge>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                {filtrar(colunaPerdido.oportunidades).length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum negocio perdido
                  </p>
                ) : (
                  filtrar(colunaPerdido.oportunidades).map((oportunidade) => (
                    <div key={oportunidade.id} data-kanban-card>
                      <CardOportunidade
                        oportunidade={oportunidade}
                        onAbrirFicha={setContatoAberto}
                        arrastando={arrastandoId === oportunidade.id}
                      />
                    </div>
                  ))
                )}
              </div>
            </Coluna>
          )}
        </div>

        <DragOverlay>
          {cardArrastado ? <CardOportunidade oportunidade={cardArrastado} /> : null}
        </DragOverlay>
      </DndContext>

      <FichaLead
        contatoId={contatoAberto}
        onOpenChange={(aberta) => {
          if (!aberta) setContatoAberto(null)
        }}
      />

      {/* Motivo padronizado ao arrastar para Perdido (mesmo dialog do kanban-crm). */}
      <MotivoPerdaDialog
        open={!!pendentePerda}
        nomeNegocio={pendentePerda?.nome}
        onCancel={() => setPendentePerda(null)}
        onConfirm={(motivo) => {
          void confirmarPerda(motivo)
          setPendentePerda(null)
        }}
      />
    </>
  )
}
