'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Botão de alternância claro/escuro. Monta só após `mounted` para evitar
// mismatch de hidratação (o tema real só é conhecido no cliente, via
// localStorage do next-themes).
// "Já montou no cliente?" via useSyncExternalStore: servidor → false,
// cliente → true, sem setState em effect (regra react-hooks).
function subscribeNoop() {
  return () => {}
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  // Placeholder do mesmo tamanho antes de montar, para não deslocar o header.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label="Alternar tema"
        disabled
      />
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
