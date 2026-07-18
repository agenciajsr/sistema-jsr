'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Polling LEVE de quase tempo real (quick 260717-pvr): rebusca os dados do
// Server Component via router.refresh() a cada ~30s, SÓ com a aba visível e
// quando não estiver pausado (drag ativo, dialog aberto). Ao voltar o foco
// para a aba, refresca imediatamente — com throttle de 5s para focus +
// visibilitychange não dispararem em dobro.
//
// Sem endpoint novo, sem Supabase Realtime: reusa o fluxo de dados existente
// (getCrmVisaoGeral). 1 refresh/30s por aba visível é o custo aceito.
export function useRefreshPeriodico({
  pausado = false,
  intervaloMs = 30_000,
}: {
  pausado?: boolean
  intervaloMs?: number
} = {}) {
  const router = useRouter()

  // `pausado` lido via ref (atualizada em effect, não durante o render —
  // regra react-hooks/refs): o interval e os listeners são criados UMA vez.
  const pausadoRef = useRef(pausado)
  useEffect(() => {
    pausadoRef.current = pausado
  }, [pausado])

  // Timestamp do último refresh (throttle): evita refresh duplo quando focus e
  // visibilitychange disparam juntos. Inicializado no effect (Date.now() é
  // impuro para inicializador de render — regra react-hooks/purity).
  const ultimoRefreshRef = useRef(0)

  useEffect(() => {
    const THROTTLE_MS = 5_000
    // Monta "agora": o throttle vale desde o mount (o dado acabou de vir do server).
    ultimoRefreshRef.current = Date.now()

    function refrescar() {
      if (pausadoRef.current) return
      if (document.visibilityState !== 'visible') return
      const agora = Date.now()
      if (agora - ultimoRefreshRef.current < THROTTLE_MS) return
      ultimoRefreshRef.current = agora
      router.refresh()
    }

    // Tick periódico: só age com a aba visível e sem pausa.
    const intervalo = setInterval(refrescar, intervaloMs)

    // Volta do foco/visibilidade: refresh imediato (o usuário quer ver o
    // estado atual AGORA, não daqui a até 30s).
    function aoVoltar() {
      refrescar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [router, intervaloMs])
}
