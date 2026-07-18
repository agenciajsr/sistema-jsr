import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/app-sidebar'
import { BuscaGlobal } from '@/components/layout/busca-global'
import { AlertasBell } from '@/components/layout/alertas-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth/session'

const CARGO_POR_ROLE: Record<'admin' | 'membro', string> = {
  admin: 'Administrador',
  membro: 'Membro',
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentUser = await getCurrentUser()

  // Defesa em profundidade — proxy.ts já protege a rota, isto cobre casos de
  // navegação direta/refresh onde o proxy não interceptou por algum motivo.
  if (!currentUser) {
    redirect('/login')
  }

  const cargo = CARGO_POR_ROLE[currentUser.role]

  return (
    <SidebarProvider>
      <AppSidebar nome={currentUser.nome} cargo={cargo} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-card/70 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <BuscaGlobal />

            <ThemeToggle />

            <AlertasBell />
          </div>
        </header>
        {/* min-w-0: sem isto, um item flex nunca encolhe abaixo da largura do
            proprio conteudo — uma linha larga (ex.: o kanban do CRM) estica a
            PAGINA INTEIRA e joga header/abas para fora da tela. Com min-w-0 a
            pagina respeita a viewport e quem rola e so o container interno. */}
        <main className="min-w-0 flex-1 bg-background p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
