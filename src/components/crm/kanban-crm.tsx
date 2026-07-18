'use client'

import { useRef, useState } from 'react'
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
import { Trophy, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import {
  moverOportunidade,
  moverParaGanho,
  moverParaPerdido,
  reabrirOportunidade,
} from '@/actions/crm'
import { criarReuniaoCrm } from '@/actions/crm-atividades'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CardOportunidade } from '@/components/crm/card-oportunidade'
import { ConverterClienteDialog } from '@/components/crm/converter-cliente-dialog'
import { FichaLead } from '@/components/crm/ficha-lead'
import { MotivoPerdaDialog } from '@/components/crm/motivo-perda-dialog'
import { ReuniaoDialog, type ReuniaoValores } from '@/components/crm/reuniao-dialog'
import { ehEtapaReuniaoAgendada } from '@/lib/crm/reuniao'
import type { ColunaFechada, ColunaKanban, OportunidadeCard } from '@/lib/crm/dados'

// Board do CRM (D-04/D-05/D-07): as 6 etapas do banco + Ganho e Perdido como
// colunas VIRTUAIS ao fim. Ganho/Perdido NAO sao linhas de crm_etapas — sao o
// `status` da oportunidade (padrao Pipedrive). Arrastar para elas muda o status;
// arrastar de volta para uma etapa REABRE o negocio.
//
// So o container do board rola na horizontal — a rolagem da PAGINA ja foi
// corrigida pelo min-w-0 no SidebarInset (D-08). Nao mexer no layout externo.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const GANHO = 'ganho'
const PERDIDO = 'perdido'

// Estado local do board: id da coluna -> cards. As chaves sao o id da etapa OU
// 'ganho'/'perdido' (as virtuais).
type Quadro = Record<string, OportunidadeCard[]>

function montarQuadro(colunas: ColunaKanban[], colunasFechadas: ColunaFechada[]): Quadro {
  const quadro: Quadro = {}
  for (const c of colunas) quadro[c.etapa.id] = c.oportunidades
  for (const c of colunasFechadas) quadro[c.chave] = c.oportunidades
  return quadro
}

function somar(cards: OportunidadeCard[]): number {
  return cards.reduce((soma, o) => soma + (o.valor ?? 0), 0)
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

/**
 * Board com PAN por arrasto ("mãozinha"): segurar e arrastar o FUNDO do board
 * rola na horizontal. Cards/botões ficam de fora (senão brigaria com o
 * drag-and-drop do dnd-kit, que já começa no pointerdown do card).
 */
function BoardComPan({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const pan = useRef<{ startX: number; scrollLeft: number } | null>(null)

  function aoPressionar(e: React.PointerEvent<HTMLDivElement>) {
    // Só o fundo: elementos interativos (cards dnd, botões, inputs) não iniciam pan.
    const alvo = e.target as HTMLElement
    if (alvo.closest('[data-kanban-card], button, input, a, [role="button"]')) return
    if (!ref.current) return
    pan.current = { startX: e.clientX, scrollLeft: ref.current.scrollLeft }
    ref.current.setPointerCapture(e.pointerId)
  }

  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!pan.current || !ref.current) return
    ref.current.scrollLeft = pan.current.scrollLeft - (e.clientX - pan.current.startX)
  }

  function aoSoltar() {
    pan.current = null
  }

  return (
    <div
      ref={ref}
      onPointerDown={aoPressionar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      // Altura fixa pela viewport: a PÁGINA não cresce com os cards — cada
      // coluna rola por dentro. Ajuste fino do desconto se o header mudar.
      className="flex h-[calc(100dvh-230px)] min-h-[540px] cursor-grab gap-4 overflow-x-auto overflow-y-hidden pb-2 active:cursor-grabbing"
    >
      {children}
    </div>
  )
}

export function KanbanCrm({
  colunas,
  colunasFechadas,
  oportunidadesVisiveis,
  onArrastandoChange,
}: {
  colunas: ColunaKanban[]
  colunasFechadas: ColunaFechada[]
  // Filtro da busca: quando presente, so renderiza os cards com id no Set.
  // A contagem e o valor do header seguem os dados da coluna — o header
  // descreve a etapa inteira, nao o recorte da busca.
  oportunidadesVisiveis?: Set<string>
  // Sinaliza ao pai (CrmView) que um drag esta ativo — usado para PAUSAR o
  // polling de quase tempo real durante o arrasto (quick 260717-pvr).
  onArrastandoChange?: (ativo: boolean) => void
}) {
  const router = useRouter()
  const [quadro, setQuadro] = useState<Quadro>(() => montarQuadro(colunas, colunasFechadas))
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [contatoAberto, setContatoAberto] = useState<string | null>(null)
  // Card recém-GANHO aguardando a oferta "Converter em cliente?" (Fase 3 do
  // funil). null = dialog fechado. Cancelar NÃO desfaz o ganho.
  const [conversaoPendente, setConversaoPendente] = useState<OportunidadeCard | null>(null)
  // Card arrastado para Perdido aguardando o motivo no MotivoPerdaDialog
  // (quick 260716-khp). Nada é movido/persistido antes da confirmação —
  // cancelar deixa o card exatamente onde estava (mesmo contrato do antigo
  // prompt nativo que este dialog substituiu).
  const [pendentePerda, setPendentePerda] = useState<{ id: string; nome: string } | null>(null)
  // Card arrastado para "Reunião agendada" aguardando data/hora no
  // ReuniaoDialog (quick 260716-kq1). Mesmo contrato do pendentePerda:
  // nada é movido antes da confirmação; cancelar deixa o card onde estava.
  const [pendenteReuniao, setPendenteReuniao] = useState<{
    id: string
    nome: string
    destino: string
    origem: string
  } | null>(null)

  // Etapas cujo nome é "Reunião agendada" (tolerante a acento/caixa) — a
  // detecção é por nome porque as etapas não têm chave semântica no banco.
  const etapasReuniao = new Set(
    colunas.filter((c) => ehEtapaReuniaoAgendada(c.etapa.nome)).map((c) => c.etapa.id),
  )

  // RESSINCRONIZACAO com o servidor: o movimento otimista pinta o quadro na
  // hora e o router.refresh() traz a verdade depois — sem isto o board ficaria
  // preso ao estado otimista para sempre.
  //
  // Ajuste DURANTE O RENDER (padrao oficial do React para "resetar estado
  // quando a prop muda"), nao num useEffect: o React descarta este render e
  // re-renderiza na hora, sem pintar o quadro velho e sem o efeito em cascata
  // que o lint (corretamente) recusa.
  const [propsAnteriores, setPropsAnteriores] = useState({ colunas, colunasFechadas })
  if (
    propsAnteriores.colunas !== colunas ||
    propsAnteriores.colunasFechadas !== colunasFechadas
  ) {
    setPropsAnteriores({ colunas, colunasFechadas })
    setQuadro(montarQuadro(colunas, colunasFechadas))
  }

  // Distancia de ativacao: sem isso qualquer clique (abrir a ficha) viraria um
  // drag de 0px e a ficha nunca abriria.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function acharCard(id: string): { card: OportunidadeCard; colunaId: string } | null {
    for (const [colunaId, cards] of Object.entries(quadro)) {
      const card = cards.find((c) => c.id === id)
      if (card) return { card, colunaId }
    }
    return null
  }

  function onDragStart(event: DragStartEvent) {
    setArrastandoId(String(event.active.id))
    onArrastandoChange?.(true)
  }

  async function onDragEnd(event: DragEndEvent) {
    // Sinaliza o fim do drag ANTES de qualquer early-return: todo caminho
    // (sem destino, mesma coluna, dialogs pendentes) despausa o polling.
    setArrastandoId(null)
    onArrastandoChange?.(false)
    const { active, over } = event
    if (!over) return

    const id = String(active.id)
    const destino = String(over.id)
    const achado = acharCard(id)
    if (!achado) return

    const origem = achado.colunaId
    if (origem === destino) return // no-op: soltou na propria coluna

    // Perder EXIGE motivo padronizado. NADA acontece antes da confirmação no
    // MotivoPerdaDialog — nem update otimista, nem action. Cancelar o dialog
    // deixa o card exatamente onde estava.
    if (destino === PERDIDO) {
      setPendentePerda({ id, nome: achado.card.titulo })
      return
    }

    // Mover para "Reunião agendada" EXIGE agendar a reunião (atividade +
    // Google Calendar). NADA acontece antes da confirmação no ReuniaoDialog —
    // cancelar deixa o card exatamente onde estava.
    if (etapasReuniao.has(destino)) {
      setPendenteReuniao({ id, nome: achado.card.titulo, destino, origem })
      return
    }

    // (1) guarda o estado anterior (rollback) e move na hora.
    const anterior = quadro
    const status: OportunidadeCard['status'] = destino === GANHO ? 'ganha' : 'aberta'
    const cardMovido: OportunidadeCard = {
      ...achado.card,
      status,
      // etapaId so muda quando o destino e uma etapa DE VERDADE.
      etapaId: destino === GANHO ? achado.card.etapaId : destino,
      motivoPerda: null,
    }
    setQuadro({
      ...quadro,
      [origem]: (quadro[origem] ?? []).filter((c) => c.id !== id),
      [destino]: [cardMovido, ...(quadro[destino] ?? [])],
    })

    // (2) despacha conforme o destino.
    const eraFechado = origem === GANHO || origem === PERDIDO
    let result: { error?: string } | { data?: unknown }

    if (destino === GANHO) {
      result = await moverParaGanho(id)
    } else if (eraFechado) {
      // Voltar de Ganho/Perdido para uma etapa = REABRIR e so entao mover.
      // Sequencial de proposito (pool max=3): nunca Promise.all.
      const reaberto = await reabrirOportunidade(id)
      result = 'error' in reaberto ? reaberto : await moverOportunidade(id, destino)
    } else {
      result = await moverOportunidade(id, destino)
    }

    // (3) erro -> restaura EXATAMENTE o estado anterior e explica.
    if ('error' in result && result.error) {
      setQuadro(anterior)
      toast.error(result.error)
      return
    }

    toast.success(
      destino === GANHO ? 'Negocio ganho.' : eraFechado ? 'Negocio reaberto.' : 'Negocio movido.',
    )

    // Ganho confirmado no servidor → oferece a conversão em cliente. Só quando
    // o negócio ainda NÃO virou cliente (clienteId nulo) — já convertido não
    // reabre o dialog.
    if (destino === GANHO && !cardMovido.clienteId) {
      setConversaoPendente(cardMovido)
    }
    router.refresh()
  }

  // Efetiva a perda DEPOIS do motivo confirmado no dialog: mesmo fluxo
  // otimista dos outros destinos (guardar anterior → mover → action →
  // rollback em erro). Re-localiza o card no momento da confirmação — o
  // quadro pode ter mudado enquanto o dialog estava aberto.
  async function confirmarPerda(motivo: string) {
    if (!pendentePerda) return
    const { id } = pendentePerda
    const achado = acharCard(id)
    if (!achado) return // card sumiu do quadro — nada a fazer

    const anterior = quadro
    const cardMovido: OportunidadeCard = {
      ...achado.card,
      status: 'perdida',
      motivoPerda: motivo,
    }
    setQuadro({
      ...quadro,
      [achado.colunaId]: (quadro[achado.colunaId] ?? []).filter((c) => c.id !== id),
      [PERDIDO]: [cardMovido, ...(quadro[PERDIDO] ?? [])],
    })

    const result = await moverParaPerdido(id, motivo)
    if ('error' in result && result.error) {
      setQuadro(anterior)
      toast.error(result.error)
      return
    }

    toast.success('Negocio marcado como perdido.')
    router.refresh()
  }

  // Efetiva o agendamento DEPOIS da confirmação no ReuniaoDialog: move o card
  // (otimista, com reabrir quando vinha de Ganho/Perdido), então cria a
  // reunião (atividade + evento no Google Calendar). Se a criação da reunião
  // falhar, o movimento NÃO é revertido — a etapa mudou de verdade no banco.
  async function confirmarReuniao(valores: ReuniaoValores) {
    if (!pendenteReuniao) return
    const { id, destino, origem } = pendenteReuniao
    // Re-localiza o card no momento da confirmação — o quadro pode ter mudado
    // enquanto o dialog estava aberto.
    const achado = acharCard(id)
    if (!achado) return

    const anterior = quadro
    const cardMovido: OportunidadeCard = {
      ...achado.card,
      status: 'aberta',
      etapaId: destino,
      motivoPerda: null,
    }
    setQuadro({
      ...quadro,
      [achado.colunaId]: (quadro[achado.colunaId] ?? []).filter((c) => c.id !== id),
      [destino]: [cardMovido, ...(quadro[destino] ?? [])],
    })

    // SEQUENCIAL de propósito (pool max=3): reabrir (se vinha de fechado) →
    // mover → criar a reunião. Nunca Promise.all.
    if (origem === GANHO || origem === PERDIDO) {
      const reaberto = await reabrirOportunidade(id)
      if ('error' in reaberto && reaberto.error) {
        setQuadro(anterior)
        toast.error(reaberto.error)
        return
      }
    }

    const movido = await moverOportunidade(id, destino)
    if ('error' in movido && movido.error) {
      setQuadro(anterior)
      toast.error(movido.error)
      return
    }

    const result = await criarReuniaoCrm({ oportunidadeId: id, ...valores })
    if ('error' in result && result.error) {
      // A etapa já mudou no servidor — não reverter o movimento.
      toast.error(`Card movido, mas a reunião não foi criada: ${result.error}`)
    } else if ('data' in result && result.data?.avisoCalendar) {
      toast.warning(result.data.avisoCalendar)
    } else if ('data' in result && result.data?.meetLink) {
      toast.success('Reunião agendada — Meet criado e convite enviado ao lead.', {
        description: result.data.meetLink,
      })
    } else {
      toast.success('Reunião agendada e evento criado no Google Calendar.')
    }

    router.refresh()
  }

  const cardArrastado = arrastandoId ? acharCard(arrastandoId)?.card : null
  const filtrando = oportunidadesVisiveis != null

  function filtrar(cards: OportunidadeCard[]) {
    return oportunidadesVisiveis ? cards.filter((o) => oportunidadesVisiveis.has(o.id)) : cards
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        // Drag cancelado (Esc, perda de foco) tambem despausa o polling.
        onDragCancel={() => {
          setArrastandoId(null)
          onArrastandoChange?.(false)
        }}
      >
        <BoardComPan>
          {/* As etapas REAIS do pipeline. */}
          {colunas.map((coluna) => {
            const cards = quadro[coluna.etapa.id] ?? []
            const visiveis = filtrar(cards)
            const soma = somar(cards)

            return (
              <Coluna key={coluna.etapa.id} id={coluna.etapa.id}>
                <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-sm)]">
                  {/* Faixa da cor da etapa (quando cadastrada), como no mockup. */}
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: coluna.etapa.cor ?? 'var(--border)' }}
                  />
                  <div className="space-y-1 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{coluna.etapa.nome}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
                        {cards.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {/* O dinheiro PARADO nesta etapa. */}
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {soma > 0 ? formatoBRL.format(soma) : '—'}
                      </span>
                      {coluna.etapa.probabilidade != null && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {coluna.etapa.probabilidade}% prob.
                        </span>
                      )}
                    </div>
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

          {/* Colunas VIRTUAIS: derivadas do status, nunca linhas em crm_etapas. */}
          {colunasFechadas.map((coluna) => {
            const cards = quadro[coluna.chave] ?? []
            const visiveis = filtrar(cards)
            const ganho = coluna.chave === GANHO
            const Icone = ganho ? Trophy : XCircle

            return (
              <Coluna key={coluna.chave} id={coluna.chave}>
                <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-sm)]">
                  <div className={cn('h-1 w-full', ganho ? 'bg-emerald-500' : 'bg-red-500')} />
                  <div className="space-y-1 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'flex items-center gap-1.5 truncate text-sm font-semibold',
                          ganho ? 'text-emerald-600' : 'text-red-600',
                        )}
                      >
                        <Icone className="size-3.5 shrink-0" />
                        {coluna.nome}
                      </p>
                      <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
                        {coluna.total}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {coluna.somaValor > 0 ? formatoBRL.format(coluna.somaValor) : '—'}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {coluna.total} {coluna.total === 1 ? 'negocio' : 'negocios'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Honestidade: o board lista so os mais recentes; o header ja
                    mostra o total real do banco. */}
                {coluna.total > coluna.oportunidades.length && (
                  <p className="text-[10px] text-muted-foreground">
                    Mostrando os {coluna.oportunidades.length} mais recentes de {coluna.total}.
                  </p>
                )}

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                  {visiveis.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      {filtrando && cards.length > 0
                        ? 'Nada encontrado'
                        : ganho
                          ? 'Nenhum negocio ganho'
                          : 'Nenhum negocio perdido'}
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
        </BoardComPan>

        {/* O card segue o cursor durante o arrasto. */}
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

      {/* Motivo padronizado ao arrastar para Perdido (quick 260716-khp). */}
      <MotivoPerdaDialog
        open={!!pendentePerda}
        nomeNegocio={pendentePerda?.nome}
        onCancel={() => setPendentePerda(null)}
        onConfirm={(motivo) => {
          void confirmarPerda(motivo)
          setPendentePerda(null)
        }}
      />

      {/* Agendamento ao arrastar para "Reunião agendada" (quick 260716-kq1). */}
      <ReuniaoDialog
        open={!!pendenteReuniao}
        nomeNegocio={pendenteReuniao?.nome}
        onCancel={() => setPendenteReuniao(null)}
        onConfirm={(v) => {
          void confirmarReuniao(v)
          setPendenteReuniao(null)
        }}
      />

      {/* Oferta pós-ganho: converter o lead em cliente da agência (Fase 3). */}
      <ConverterClienteDialog
        oportunidade={conversaoPendente}
        onOpenChange={(aberta) => {
          if (!aberta) setConversaoPendente(null)
        }}
      />
    </>
  )
}
