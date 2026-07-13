import { redirect } from 'next/navigation'

// Consolidado: a gestão de pessoas agora vive em /equipe (listar, adicionar e
// remover membros). Esta rota é mantida apenas para não quebrar links antigos.
export default function UsuariosPage() {
  redirect('/equipe')
}
