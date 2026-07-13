import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'

import { PerfilForms } from './perfil-forms'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

export default async function PerfilPage() {
  const current = await getCurrentUser()
  if (!current) {
    redirect('/login')
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu nome e sua senha de acesso.
        </p>
      </div>

      <PerfilForms nomeInicial={current.nome} email={current.email ?? ''} />
    </div>
  )
}
