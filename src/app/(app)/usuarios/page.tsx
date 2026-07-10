import { redirect } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/session'

import { FormularioUsuario } from './formulario-usuario'

export default async function UsuariosPage() {
  const usuario = await getCurrentUser()

  // D-02: apenas Admin pode criar novos usuários — Membro não deve ver este
  // formulário.
  if (!usuario || usuario.role !== 'admin') {
    redirect('/clientes')
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Usuário</CardTitle>
          <CardDescription>
            Crie uma nova conta de acesso para a equipe da JSR (Admin ou
            Membro).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioUsuario />
        </CardContent>
      </Card>
    </div>
  )
}
