'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { aiInsightMock } from '@/lib/mock/dashboard-ref'

// Card flutuante de Insights da IA (canto inferior direito), fechável.
// Ao montar, busca insight gerado pela OpenAI via /api/insights (streaming).
// Fallback silencioso: exibe aiInsightMock.texto em caso de erro/sem chave.
export function AiInsightFloat() {
  const [aberto, setAberto] = useState(true)
  const [texto, setTexto] = useState<string>('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function buscarInsight() {
      try {
        const res = await fetch('/api/insights')
        if (!res.ok || !res.body) {
          // Fallback silencioso: usar mock
          if (!cancelado) {
            setTexto(aiInsightMock.texto)
            setCarregando(false)
          }
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acumulado = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          acumulado += decoder.decode(value, { stream: true })
          if (!cancelado) setTexto(acumulado)
        }
        if (!cancelado) setCarregando(false)
      } catch {
        // Erro de rede — fallback silencioso
        if (!cancelado) {
          setTexto(aiInsightMock.texto)
          setCarregando(false)
        }
      }
    }

    void buscarInsight()
    return () => {
      cancelado = true
    }
  }, [])

  if (!aberto) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl bg-[#0b1a33] text-white shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
      {/* Detalhe gráfico sutil de "circuito"/brilho ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(120px 120px at 90% 0%, rgba(56,132,214,0.35), transparent 70%), radial-gradient(160px 160px at 0% 100%, rgba(124,58,237,0.25), transparent 70%)',
        }}
      />
      <div className="relative p-5">
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar insights da IA"
          className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>

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
