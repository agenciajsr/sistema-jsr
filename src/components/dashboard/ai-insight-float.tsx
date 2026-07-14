'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Brain, ChevronDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { aiInsightMock } from '@/lib/mock/dashboard-ref'

// Card flutuante de Insights da IA (canto inferior direito).
// RECOLHIDO por padrão (só um botão compacto) para não ocupar a tela; expande ao
// clicar. A busca na OpenAI (/api/insights, streaming) só acontece na 1ª expansão,
// evitando chamadas desnecessárias quando o usuário não abre. Fallback: aiInsightMock.
export function AiInsightFloat() {
  const [expandido, setExpandido] = useState(false)
  const [fechado, setFechado] = useState(false)
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [jaBuscou, setJaBuscou] = useState(false)

  async function abrir() {
    setExpandido(true)
    if (jaBuscou) return
    setJaBuscou(true)
    setCarregando(true)
    try {
      const res = await fetch('/api/insights')
      if (!res.ok || !res.body) {
        setTexto(aiInsightMock.texto)
        setCarregando(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setTexto(acumulado)
      }
      setCarregando(false)
    } catch {
      setTexto(aiInsightMock.texto)
      setCarregando(false)
    }
  }

  if (fechado) return null

  // Estado RECOLHIDO: botão compacto.
  if (!expandido) {
    return (
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir Insights da IA"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-[#0b1a33] px-4 py-3 text-sm font-medium text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-transform hover:-translate-y-0.5"
      >
        <span className="flex size-6 items-center justify-center rounded-lg bg-white/10">
          <Brain className="size-4" />
        </span>
        Insights da IA
      </button>
    )
  }

  // Estado EXPANDIDO: card completo.
  return (
    <div className="fixed bottom-6 right-6 z-40 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl bg-[#0b1a33] text-white shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(120px 120px at 90% 0%, rgba(56,132,214,0.35), transparent 70%), radial-gradient(160px 160px at 0% 100%, rgba(124,58,237,0.25), transparent 70%)',
        }}
      />
      <div className="relative p-5">
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpandido(false)}
            aria-label="Recolher insights da IA"
            title="Recolher"
            className="inline-flex size-7 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setFechado(true)}
            aria-label="Fechar insights da IA"
            title="Fechar"
            className="inline-flex size-7 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
            <Brain className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Insights da IA</p>
            <span className="mt-1 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
              Beta
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/90">
          {carregando ? (
            <span className="italic text-white/50">Analisando dados da agência...</span>
          ) : (
            texto
          )}
        </p>

        <Link href="/chat-ia">
          <Button className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Ver análise completa
          </Button>
        </Link>
      </div>
    </div>
  )
}
