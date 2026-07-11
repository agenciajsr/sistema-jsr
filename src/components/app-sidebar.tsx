'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileSignature,
  TrendingUp,
  Wallet,
  FileText,
  Bell,
  ShieldCheck,
  ListChecks,
  Radar,
  CircleDollarSign,
  Filter,
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
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

const clientesNav: NavItem[] = [
  { title: 'Visão Geral', url: '/painel', icon: LayoutDashboard },
  { title: 'Clientes', url: '/clientes', icon: Users },
  { title: 'Contratos', url: '/contratos', icon: FileSignature },
]

const operacaoNav: NavItem[] = [
  { title: 'Tráfego Pago', url: '/trafego', icon: TrendingUp },
  { title: 'Verbas Ads', url: '/verbas-ads', icon: CircleDollarSign },
  { title: 'Funil', url: '/funil', icon: Filter },
  { title: 'Checklist', url: '/checklist', icon: ListChecks },
  { title: 'Acompanhamento', url: '/acompanhamento', icon: Radar },
]

const gestaoNav: NavItem[] = [
  { title: 'Financeiro', url: '/financeiro', icon: Wallet },
  { title: 'Relatórios', url: '/relatorios', icon: FileText },
  { title: 'Alertas', url: '/alertas', icon: Bell },
]

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.url || pathname.startsWith(`${item.url}/`)
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            JSR
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-none">Sistema JSR</p>
            <p className="text-xs text-muted-foreground">Agência JSR</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Clientes" items={clientesNav} pathname={pathname} />
        <NavGroup label="Operação" items={operacaoNav} pathname={pathname} />
        <NavGroup label="Gestão" items={gestaoNav} pathname={pathname} />

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
      <SidebarFooter />
    </Sidebar>
  )
}
