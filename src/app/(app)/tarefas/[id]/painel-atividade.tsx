'use client'

// Painel "Atividade" estilo ClickUp (quick 260719-qr2): feed cronológico único
// (comentários destacados + eventos discretos) com scroll próprio e composer
// SEMPRE visível no rodapé. Componente burro: recebe handlers, nunca chama
// action direto. Tudo via tokens do tema — dark mode automático.

import { useEffect, useMemo, useRef, useState } from 'react'
import { History, MoreHorizontal, SendHorizonal } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TarefaDetalhe as TarefaDetalheTipo, ComentarioTarefa } from '@/lib/tarefas/dados'
import { corDoAvatar, iniciais, montarFeedAtividade, tempoRelativo } from '@/lib/tarefas/quadro'
import { AtividadeLinha } from './tarefa-lateral'

function ComentarioCard({
  comentario,
  agora,
  usuarioId,
  onRemover,
}: {
  comentario: ComentarioTarefa
  agora: string
  usuarioId: string
  onRemover: (id: string) => void
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback
            className={`text-[10px] font-semibold ${corDoAvatar(comentario.autorId)}`}
          >
            {iniciais(comentario.autorNome)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">{comentario.autorNome}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {tempoRelativo(comentario.createdAt, agora)}
        </span>
        {comentario.autorId === usuarioId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Ações do comentário"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRemover(comentario.id)}
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{comentario.texto}</p>
    </div>
  )
}

export function PainelAtividade({
  tarefa,
  agora,
  usuarioId,
  enviando,
  onEnviarComentario,
  onRemoverComentario,
}: {
  tarefa: TarefaDetalheTipo
  agora: string
  usuarioId: string
  enviando: boolean
  onEnviarComentario: (texto: string) => void
  onRemoverComentario: (id: string) => void
}) {
  const [texto, setTexto] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const feed = useMemo(
    () => montarFeedAtividade(tarefa.comentarios, tarefa.atividades),
    [tarefa.comentarios, tarefa.atividades]
  )

  // Feed ascendente: o mais recente fica embaixo, junto do composer — rola
  // para o fim ao montar e quando entram itens novos.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed.length])

  function enviar() {
    const limpo = texto.trim()
    if (!limpo || enviando) return
    onEnviarComentario(limpo)
    setTexto('')
  }

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
      <CardHeader className="flex shrink-0 items-center gap-2 space-y-0 border-b px-4 py-3">
        <History className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm">Atividade</CardTitle>
      </CardHeader>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          feed.map((item) =>
            item.kind === 'comentario' ? (
              <ComentarioCard
                key={item.key}
                comentario={item.comentario}
                agora={agora}
                usuarioId={usuarioId}
                onRemover={onRemoverComentario}
              />
            ) : (
              <AtividadeLinha key={item.key} atv={item.atividade} agora={agora} compacta />
            )
          )
        )}
      </div>

      <div className="shrink-0 border-t bg-card p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar()
              }
            }}
            rows={2}
            placeholder="Escreva um comentário..."
            aria-label="Novo comentário"
            className="min-h-0 resize-none"
          />
          <Button
            size="icon"
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            aria-label="Enviar comentário"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
