'use client'

import { Bot, SendHorizontal, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { MockNotice } from '@/components/mock-notice'
import { cn } from '@/lib/utils'

// Interface de chat premium do Copilot. Client component. Consome a rota
// protegida /api/chat como um stream de texto simples (fetch + reader) — o
// projeto usa apenas `ai` + `@ai-sdk/openai` no servidor, sem hook de client.

type Papel = 'user' | 'assistant'
type Mensagem = { id: string; role: Papel; content: string }

const SUGESTOES = [
  'Qual cliente está em risco e por quê?',
  'Resuma o financeiro do mês',
  'Qual campanha devo priorizar?',
  'O que precisa da minha atenção hoje?',
]

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

export default function ChatIaPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  // Auto-scroll: mantém a visão no fim quando chegam mensagens/chunks.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  function atualizarConteudo(id: string, conteudo: string) {
    setMensagens((atual) =>
      atual.map((m) => (m.id === id ? { ...m, content: conteudo } : m)),
    )
  }

  async function enviar(texto: string) {
    const conteudo = texto.trim()
    if (!conteudo || carregando) return

    const mensagemUsuario: Mensagem = {
      id: novoId(),
      role: 'user',
      content: conteudo,
    }
    const idAssistente = novoId()
    const historico = [...mensagens, mensagemUsuario]

    setMensagens([
      ...historico,
      { id: idAssistente, role: 'assistant', content: '' },
    ])
    setInput('')
    setCarregando(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historico.map(({ role, content }) => ({ role, content })),
        }),
      })

      if (!res.ok || !res.body) {
        atualizarConteudo(
          idAssistente,
          res.status === 401
            ? 'Sua sessão expirou. Faça login novamente para usar o Copilot.'
            : 'Não consegui responder agora. Tente novamente em instantes.',
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        atualizarConteudo(idAssistente, acumulado)
      }
      if (acumulado.trim() === '') {
        atualizarConteudo(
          idAssistente,
          'Não recebi conteúdo na resposta. Tente novamente.',
        )
      }
    } catch {
      atualizarConteudo(
        idAssistente,
        'Não consegui responder agora. Verifique sua conexão e tente novamente.',
      )
    } finally {
      setCarregando(false)
    }
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviar(input)
    }
  }

  const vazio = mensagens.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Chat com IA</h1>
        <Badge variant="secondary">Beta</Badge>
      </div>

      <MockNotice>
        O Copilot analisa <strong>dados de exemplo</strong> por enquanto. Quando
        as integrações reais (Meta/Google Ads e financeiro) entrarem, ele passará
        a analisar os números reais da agência.
      </MockNotice>

      <Card className="flex h-[calc(100vh-16rem)] min-h-[26rem] flex-col gap-0 overflow-hidden py-0">
        {/* Lista de mensagens */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {vazio ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Sparkles className="size-7" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                Como posso ajudar hoje?
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Pergunte sobre a saúde dos clientes, verba, campanhas ou
                financeiro. Traço sempre uma análise com sugestão de ação.
              </p>
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviar(s)}
                    disabled={carregando}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-[var(--shadow-sm)] transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {mensagens.map((m) => {
                const doUsuario = m.role === 'user'
                const digitando =
                  m.role === 'assistant' && m.content === '' && carregando
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-3',
                      doUsuario ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {!doUsuario && (
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                        <Bot className="size-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                        doUsuario
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      {digitando ? (
                        <span className="inline-flex gap-1 py-1">
                          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-current" />
                        </span>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Área de input */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={aoTeclar}
              placeholder="Pergunte ao Copilot… (Enter envia, Shift+Enter quebra linha)"
              rows={1}
              className="max-h-40 min-h-11 flex-1 resize-none"
              disabled={carregando}
            />
            <Button
              type="button"
              size="icon-lg"
              onClick={() => void enviar(input)}
              disabled={carregando || input.trim() === ''}
              aria-label="Enviar mensagem"
            >
              <SendHorizontal className="size-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
