'use client'

import { useDraggable } from '@dnd-kit/core'
import { AlertTriangle, Building2, Clock, MessageSquare, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { corOrigem, rotuloOrigem } from '@/lib/crm/origem'
import { rotuloServico } from '@/lib/crm/servicos'
import { tempoRelativoCurto } from '@/lib/crm/tempo'
import type { OportunidadeCard } from '@/lib/crm/dados'

// O card do LEAD-negocio (D-03): o NOME DO LEAD e o destaque e o servico e o
// subtitulo. Um negocio = um card; a mesma pessoa pode aparecer em varios.
//
// Sem Select de etapa e sem botoes Ganhar/Perder: mover virou DRAG (o Select
// dentro do card foi rejeitado pelo usuario). Por isso este componente nao chama
// action nenhuma — quem despacha e o board, no onDragEnd.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const ROTULO_RECEITA: Record<string, string> = {
  mensalidade: 'Mensalidade',
  projeto: 'Projeto',
}

export function CardOportunidade({
  oportunidade,
  onAbrirFicha,
  arrastando,
}: {
  oportunidade: OportunidadeCard
  onAbrirFicha?: (contatoId: string) => void
  // Estilo fantasma: o card original enquanto a copia segue o cursor.
  arrastando?: boolean
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: oportunidade.id })

  const podeAbrir = Boolean(oportunidade.contatoId && onAbrirFicha)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // O sensor usa activationConstraint por DISTANCIA: clique parado abre a
      // ficha, arrastar 8px vira drag — os dois gestos nao brigam.
      onClick={() => {
        if (oportunidade.contatoId && onAbrirFicha) onAbrirFicha(oportunidade.contatoId)
      }}
      className={cn(
        'space-y-2 rounded-lg border bg-card p-3 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        podeAbrir && 'cursor-pointer',
        arrastando && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* NOME DO LEAD em destaque (titulo so como rede de seguranca do dado antigo). */}
        <p className="text-sm font-semibold leading-snug">
          {oportunidade.contatoNome ?? oportunidade.titulo}
        </p>
        {oportunidade.tipoReceita && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {ROTULO_RECEITA[oportunidade.tipoReceita] ?? oportunidade.tipoReceita}
          </Badge>
        )}
      </div>

      {/* Servico como subtitulo — o que ESTE negocio esta vendendo. */}
      <p className="text-xs text-muted-foreground">{rotuloServico(oportunidade.servico)}</p>

      {/* Origem do lead + ha quanto tempo o negocio existe (mockup). */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          <span className={cn('size-1.5 shrink-0 rounded-full', corOrigem(oportunidade.origem))} />
          {rotuloOrigem(oportunidade.origem)}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-[10px] tabular-nums text-muted-foreground"
          title="Tempo desde a criacao"
        >
          <Clock className="size-3" />
          {tempoRelativoCurto(oportunidade.createdAt)}
        </span>
      </div>

      {/* Aviso do mockup: aberta ha +7d sem nenhuma tarefa concluida. */}
      {oportunidade.semContato && (
        <p className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600">
          <AlertTriangle className="size-3 shrink-0" />
          Nao contatado
        </p>
      )}

      {oportunidade.empresaNome && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="size-3 shrink-0" />
          {oportunidade.empresaNome}
        </p>
      )}

      {/* Motivo da perda: so existe no card perdido. */}
      {oportunidade.status === 'perdida' && oportunidade.motivoPerda && (
        <p className="text-xs text-muted-foreground">Motivo: {oportunidade.motivoPerda}</p>
      )}

      {oportunidade.valor != null && (
        <p className="text-sm font-semibold tabular-nums">{formatoBRL.format(oportunidade.valor)}</p>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-2">
        {/* Atendente: 'Sem atendente' e INFORMACAO (lead orfao), nao espaco vazio. */}
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <User className="size-3 shrink-0" />
          <span className="truncate">{oportunidade.donoNome ?? 'Sem atendente'}</span>
        </span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-[10px] tabular-nums text-muted-foreground',
            oportunidade.qtdTarefasAbertas > 0 && 'font-semibold text-amber-600',
          )}
          title={
            oportunidade.qtdTarefasAbertas > 0
              ? `${oportunidade.qtdTarefasAbertas} tarefa(s) em aberto`
              : 'Atividades registradas'
          }
        >
          <MessageSquare className="size-3" />
          {oportunidade.qtdAtividades}
        </span>
      </div>
    </div>
  )
}
