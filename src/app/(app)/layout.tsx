import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, Mail, Plus, Search } from 'lucide-react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth/session'
import { contadoresHeaderMock } from '@/lib/mock/dashboard-ref'

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
      <AppSidebar
        isAdmin={currentUser.role === 'admin'}
        nome={currentUser.nome}
        cargo={cargo}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-card/70 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            {/* Busca — placeholder visual (⌘K a ser conectado depois) */}
            <div className="relative hidden max-w-xs flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Buscar por cliente, campanha..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>

            <Link
              href="/alertas"
              aria-label="Notificações"
              className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="size-5" />
              {contadoresHeaderMock.notificacoes > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground">
                  {contadoresHeaderMock.notificacoes}
                </span>
              )}
            </Link>

            <Link
              href="/alertas"
              aria-label="Mensagens"
              className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Mail className="size-5" />
              {contadoresHeaderMock.mensagens > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">
                  {contadoresHeaderMock.mensagens}
                </span>
              )}
            </Link>

            <Button asChild size="sm" className="gap-1.5">
              <Link href="/clientes/novo">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Novo cliente</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 bg-background p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
