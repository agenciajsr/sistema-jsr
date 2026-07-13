'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// Wrapper do next-themes. attribute="class" aplica a classe `.dark` no <html>,
// casando com as variáveis de tema já definidas em globals.css. Sem tema de
// sistema (enableSystem={false}) — o usuário escolhe manualmente claro/escuro.
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
