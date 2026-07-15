'use client'

import { useDraggable } from '@dnd-kit/core'
import { AlertTriangle, Banknote, Calendar, CalendarClock, User } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rotuloOrigem } from '@/lib/crm/origem'
import { rotuloServico } from '@/lib/crm/servicos'
import { classesCorTag } from '@/lib/crm/tags'
import type { OportunidadeCard } from '@/lib/crm/dados'

// Card do LEAD-negocio fiel a imagem03 (referencia OBRIGATORIA do quick h9z):
// avatar com a inicial + nome + linha AZUL "Servico - [ORIGEM]" + #N no canto;
// linhas com icone (atendente, valor, data de criacao, atividades); tags no
// rodape; botao WhatsApp na lateral direita. SEM badge de mensalidade/projeto
// (removido de proposito — nao existe na referencia).
//
// Sem Select de etapa e sem botoes Ganhar/Perder: mover e DRAG. Este componente
// nao chama action nenhuma — quem despacha e o board, no onDragEnd.

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** dd/MM/yyyy a partir do ISO — a data de criacao da imagem03. */
function formatarData(iso: string): string {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${d.getFullYear()}`
}

/**
 * Monta o link wa.me a partir do telefone normalizado (so digitos).
 * Numeros BR de 10-11 digitos ganham o 55; se o normalizado JA vem com 55
 * (12-13 digitos), nao duplica.
 */
function linkWhatsApp(telefoneNormalizado: string): string {
  const digitos = telefoneNormalizado.replace(/\D/g, '')
  const comDdi = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  return `https://wa.me/${comDdi}`
}

/** Glifo do WhatsApp (lucide nao tem o logo oficial — path inline). */
function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
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
  const nome = oportunidade.contatoNome ?? oportunidade.titulo
  const inicial = nome.trim().charAt(0).toUpperCase() || '?'

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
      {/* Cabecalho da imagem03: avatar + nome + linha azul de servico/origem + #N. */}
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {inicial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">{nome}</p>
          {/* Linha AZUL: "{Servico} - [{ORIGEM}]" — ex.: Trafego Pago - [META ADS]. */}
          <p className="truncate text-[11px] font-medium text-blue-600 dark:text-blue-400">
            {rotuloServico(oportunidade.servico)} - [{rotuloOrigem(oportunidade.origem).toUpperCase()}]
          </p>
        </div>
        {oportunidade.numero > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            #{oportunidade.numero}
          </span>
        )}
      </div>

      {/* Aviso do mockup anterior (preservado): aberta ha +7d sem tarefa concluida. */}
      {oportunidade.semContato && (
        <p className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600">
          <AlertTriangle className="size-3 shrink-0" />
          Nao contatado
        </p>
      )}

      {/* Linhas com icone (imagem03), com o botao WhatsApp na lateral direita. */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            {/* 'Sem atendente' e INFORMACAO (lead orfao), nao espaco vazio. */}
            <span className="truncate">{oportunidade.donoNome ?? 'Sem atendente'}</span>
          </p>
          {oportunidade.valor != null && (
            <p className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
              <Banknote className="size-3.5 shrink-0 text-muted-foreground" />
              {formatoBRL.format(oportunidade.valor)}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <Calendar className="size-3.5 shrink-0" />
            {formatarData(oportunidade.createdAt)}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" />
            {oportunidade.qtdAtividades === 0
              ? 'Sem atividades'
              : `${oportunidade.qtdAtividades} atividade${oportunidade.qtdAtividades === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Botao WhatsApp: so quando o lead TEM telefone. CRITICO para nao
            brigar com o drag: stopPropagation no pointerdown (o sensor por
            distancia dispara ali) E no click (senao abriria a ficha junto). */}
        {oportunidade.telefoneNormalizado && (
          <button
            type="button"
            title="Chamar no WhatsApp"
            aria-label="Chamar no WhatsApp"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              window.open(
                linkWhatsApp(oportunidade.telefoneNormalizado as string),
                '_blank',
                'noopener',
              )
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950"
          >
            <IconeWhatsApp className="size-3.5" />
          </button>
        )}
      </div>

      {/* Motivo da perda: so existe no card perdido. */}
      {oportunidade.status === 'perdida' && oportunidade.motivoPerda && (
        <p className="text-xs text-muted-foreground">Motivo: {oportunidade.motivoPerda}</p>
      )}

      {/* Rodape: tags do LEAD (paleta CORES_TAG, mesmas classes do tags-select).
          Sem tags, o rodape nao renderiza — nada de placeholder falso. */}
      {oportunidade.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t pt-2">
          {oportunidade.tags.map((tag) => (
            <span
              key={tag.id}
              className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', classesCorTag(tag.cor))}
            >
              {tag.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
