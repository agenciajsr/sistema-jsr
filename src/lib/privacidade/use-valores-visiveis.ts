'use client'

// Estado compartilhado do "olho" de privacidade (valores financeiros ocultos
// por padrão, para apresentar a tela sem expor números). Mesma chave que o
// olhinho original dos KPIs do Painel; um evento custom sincroniza todos os
// componentes que usam o hook na mesma página em tempo real.

import { useEffect, useState } from 'react'

const CHAVE_STORAGE = 'jsr:valores-visiveis'
const EVENTO = 'jsr:valores-visiveis-mudou'

export const MASCARA_MOEDA = 'R$ ••••'

export function useValoresVisiveis() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const ler = () => setVisivel(localStorage.getItem(CHAVE_STORAGE) === '1')
    // Timeout 0: evita setState síncrono no effect (regra react-hooks).
    const t = setTimeout(ler, 0)
    window.addEventListener(EVENTO, ler)
    window.addEventListener('storage', ler)
    return () => {
      clearTimeout(t)
      window.removeEventListener(EVENTO, ler)
      window.removeEventListener('storage', ler)
    }
  }, [])

  function alternar() {
    const novo = localStorage.getItem(CHAVE_STORAGE) !== '1'
    localStorage.setItem(CHAVE_STORAGE, novo ? '1' : '0')
    window.dispatchEvent(new Event(EVENTO))
  }

  return { visivel, alternar }
}
