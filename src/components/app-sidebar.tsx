'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote,
  Bot,
  CheckSquare,
  ChevronDown,
  FileSignature,
  FileText,
  Folder,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Plug,
  ShieldCheck,
  Users,
  Users2,
  Wallet,
  Wrench,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PlanCard } from '@/components/premium/plan-card'
import { UserProfile } from '@/components/premium/user-profile'
import { planoAtualMock } from '@/lib/mock/dashboard-ref'

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  /** Chevron indicando submenu (apenas visual nesta entrega). */
  submenu?: boolean
  /** Rótulo à direita (ex.: "Beta"). */
  badge?: string
}

// Nav da referência, na mesma ordem da imagem aprovada.
const nav: NavItem[] = [
  { title: 'Dashboard', url: '/painel', icon: LayoutDashboard },
  { title: 'Clientes', url: '/clientes', icon: Users },
  { title: 'Campanhas', url: '/campanhas', icon: Megaphone },
  { title: 'Verbas', url: '/verbas', icon: Banknote },
  { title: 'Relatórios', url: '/relatorios', icon: FileText },
  { title: 'Financeiro', url: '/financeiro', icon: Wallet, submenu: true },
  { title: 'Contratos', url: '/contratos', icon: FileSignature },
  { title: 'Tarefas', url: '/tarefas', icon: ListChecks },
  { title: 'Checklists', url: '/checklist', icon: CheckSquare },
  { title: 'Documentos', url: '/documentos', icon: Folder },
  { title: 'Equipe', url: '/equipe', icon: Users2 },
  { title: 'Ferramentas', url: '/ferramentas', icon: Wrench },
  { title: 'Integrações', url: '/integracoes', icon: Plug },
  { title: 'Chat com IA', url: '/chat-ia', icon: Bot, badge: 'Beta' },
]

export function AppSidebar({
  isAdmin,
  nome,
  cargo,
}: {
  isAdmin: boolean
  nome: string
  cargo: string
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/logo-jsr.png"
              alt="JSR Agência"
              width={32}
              height={32}
              className="size-8 scale-[1.4] object-contain"
              priority
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-none">Sistema JSR</p>
            <p className="mt-1 text-xs text-muted-foreground">Agência JSR</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(`${item.url}/`)
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                        {item.submenu && (
                          <ChevronDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="bg-primary/10 text-primary">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith('/usuarios')}
                    tooltip="Usuários"
                  >
                    <Link href="/usuarios">
                      <ShieldCheck className="size-4" />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-3">
        <PlanCard
          nome={planoAtualMock.nome}
          vence={planoAtualMock.vence}
          percentUtilizado={planoAtualMock.percentUtilizado}
        />
        <UserProfile nome={nome} cargo={cargo} />
      </SidebarFooter>
    </Sidebar>
  )
}
