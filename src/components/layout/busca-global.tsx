'use client'

// Busca global do header (antes era um input decorativo). Debounce de 300ms,
// atalho ⌘K/Ctrl+K para focar, resultados em dropdown: clientes abrem a
// ficha (/clientes/[id]), leads abrem o CRM.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Target, Users } from 'lucide-react'

import { buscarGlobal, type ResultadoBusca } from '@/actions/busca'

const STATUS_ROTULO: Record<string, string> = {
  ativo: 'Ativo',
  aguardando_inicio: 'Aguardando início',
  em_aviso: 'Em aviso',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

export function BuscaGlobal() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [aberto, setAberto] = useState(false)

  // ⌘K / Ctrl+K foca o campo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fecha ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Debounce da busca (300ms). Todo setState acontece DENTRO do timeout
  // (assíncrono) — nada de setState síncrono em effect (regra react-hooks).
  useEffect(() => {
    const curto = termo.trim().length < 2
    const t = setTimeout(
      async () => {
        if (curto) {
          setResultado(null)
          return
        }
        const r = await buscarGlobal(termo)
        setResultado(r)
        setAberto(true)
      },
      curto ? 0 : 300,
    )
    return () => clearTimeout(t)
  }, [termo])

  function irPara(rota: string) {
    setAberto(false)
    setTermo('')
    setResultado(null)
    router.push(rota)
  }

  const temResultados =
    resultado != null && (resultado.clientes.length > 0 || resultado.leads.length > 0)

  return (
    <div ref={containerRef} className="relative hidden max-w-xs flex-1 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onFocus={() => resultado && setAberto(true)}
        placeholder="Buscar cliente ou lead..."
        className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>

      {aberto && resultado && (
        <div className="absolute top-11 left-0 z-50 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {!temResultados && (
            <p className="p-3 text-sm text-muted-foreground">Nada encontrado.</p>
          )}
          {resultado.clientes.length > 0 && (
            <div className="p-1">
              <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <Users className="size-3" /> Clientes
              </p>
              {resultado.clientes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => irPara(`/clientes/${c.id}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{c.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {STATUS_ROTULO[c.status] ?? c.status}
                  </span>
                </button>
              ))}
            </div>
          )}
          {resultado.leads.length > 0 && (
            <div className="border-t p-1">
              <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <Target className="size-3" /> Leads (CRM)
              </p>
              {resultado.leads.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => irPara('/crm')}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{l.nome}</span>
                  {l.telefone && (
                    <span className="shrink-0 text-xs text-muted-foreground">{l.telefone}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
