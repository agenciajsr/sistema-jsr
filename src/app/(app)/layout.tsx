import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'

import { signOut } from '@/actions/auth'
import { AppSidebar } from '@/components/app-sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth/session'
import { alertasMock } from '@/lib/mock/dashboard'

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

  return (
    <SidebarProvider>
      <AppSidebar isAdmin={currentUser.role === 'admin'} />
      <SidebarInset>
        <header className="flex items-center justify-between border-b bg-card/60 px-4 py-3 backdrop-blur-sm">
          <SidebarTrigger />
          <div className="flex items-center gap-3">
            <Link
              href="/alertas"
              aria-label="Alertas"
              className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="size-5" />
              {alertasMock.length > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground">
                  {alertasMock.length}
                </span>
              )}
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{currentUser.nome}</p>
              <p className="text-xs text-muted-foreground">{currentUser.email}</p>
            </div>
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {currentUser.nome.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Separator orientation="vertical" className="h-6" />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
