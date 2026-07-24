import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'

import { PerfilForms } from './perfil-forms'
import { FotoPerfilUpload } from './foto-perfil-upload'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

export default async function PerfilPage() {
  const current = await getCurrentUser()
  if (!current) {
    redirect('/login')
  }

  const perfil = await db.query.profiles.findFirst({
    where: eq(profiles.id, current.id),
    columns: { fotoUrl: true },
  })

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie sua foto, seu nome e sua senha de acesso.
        </p>
      </div>

      <FotoPerfilUpload nome={current.nome} fotoUrl={perfil?.fotoUrl ?? null} />

      <PerfilForms nomeInicial={current.nome} email={current.email ?? ''} />
    </div>
  )
}
