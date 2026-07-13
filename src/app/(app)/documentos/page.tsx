import { listarDocumentos } from '@/actions/documentos'
import { DocumentosPageClient } from './page-client'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

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
