import { listarDocumentos } from '@/actions/documentos'
import { DocumentosPageClient } from './page-client'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function DocumentosPage() {
  const [docs, clientesList] = await Promise.all([
    listarDocumentos(),
    db
      .select({ id: clientes.id, nome: clientes.nome })
      .from(clientes)
      .where(eq(clientes.status, 'ativo'))
      .orderBy(clientes.nome),
  ])

  return (
    <DocumentosPageClient
      documentos={docs}
      clientes={clientesList}
    />
  )
}
