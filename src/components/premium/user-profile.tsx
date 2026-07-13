'use client'

import Link from 'next/link'
import { ChevronsUpDown, LogOut, UserCog } from 'lucide-react'

import { signOut } from '@/actions/auth'
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type UserProfileProps = {
  nome: string
  cargo: string
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase() || nome.slice(0, 2).toUpperCase()
}

// Perfil do rodapé da sidebar com ponto verde de online e menu (Sair).
export function UserProfile({ nome, cargo }: UserProfileProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center">
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {iniciais(nome)}
          </AvatarFallback>
          <AvatarBadge className="bg-chart-success" aria-label="Online" />
        </Avatar>
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-medium leading-none">{nome}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{cargo}</p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{nome}</p>
          <p className="text-xs font-normal text-muted-foreground">{cargo}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil" className="w-full cursor-pointer">
            <UserCog className="size-4" />
            Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="size-4" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
