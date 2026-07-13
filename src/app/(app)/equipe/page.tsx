import { Mail, Users2 } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { listarMembros } from '@/actions/equipe'
import { getCurrentUser } from '@/lib/auth/session'

import { AdicionarMembro } from './adicionar-membro'
import { RemoverMembro } from './remover-membro'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

const CARGO_LABEL: Record<'admin' | 'membro', string> = {
  admin: 'Administrador',
  membro: 'Membro',
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase() || nome.slice(0, 2).toUpperCase()
}

export default async function EquipePage() {
  const [current, resultado] = await Promise.all([
    getCurrentUser(),
    listarMembros(),
  ])

  const isAdmin = current?.role === 'admin'
  const membros = 'data' in resultado ? resultado.data : []
  const erro = 'error' in resultado ? resultado.error : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Membros da JSR — nome, cargo e e-mail de acesso.
          </p>
        </div>
        {isAdmin && <AdicionarMembro />}
      </div>

      {erro ? (
        <Card className="border-none shadow-[var(--shadow-sm)]">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {erro}
          </CardContent>
        </Card>
      ) : membros.length === 0 ? (
        <Card className="border-none p-12 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto max-w-md space-y-2">
            <Users2 className="mx-auto size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">Nenhum membro cadastrado</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? 'Use "Adicionar membro" para criar o primeiro acesso.'
                : 'Peça a um administrador para cadastrar a equipe.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {membros.map((membro) => {
            const podeRemover = isAdmin && membro.id !== current?.id
            return (
              <Card key={membro.id} className="border-none shadow-[var(--shadow-sm)]">
                <CardContent className="flex items-start gap-3 p-4">
                  <Avatar className="size-11 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {iniciais(membro.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium leading-none">{membro.nome}</p>
                      {membro.id === current?.id && (
                        <span className="text-xs text-muted-foreground">(você)</span>
                      )}
                    </div>
                    <Badge variant={membro.role === 'admin' ? 'default' : 'secondary'}>
                      {CARGO_LABEL[membro.role]}
                    </Badge>
                    <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{membro.email ?? '—'}</span>
                    </p>
                  </div>
                  {podeRemover && (
                    <RemoverMembro id={membro.id} nome={membro.nome} />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
