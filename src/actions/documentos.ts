'use server'

import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { documentos, clientes } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { uploadFile, getSignedUrl, deleteFile } from '@/lib/storage/client'

type CategoriaDocumento = 'contrato' | 'comprovante' | 'briefing' | 'criativo' | 'relatorio' | 'outro'

const CATEGORIAS_VALIDAS: CategoriaDocumento[] = ['contrato', 'comprovante', 'briefing', 'criativo', 'relatorio', 'outro']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function uploadDocumento(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const file = formData.get('file') as File | null
  const clienteId = formData.get('clienteId') as string | null
  const categoria = formData.get('categoria') as string | null
  const notas = formData.get('notas') as string | null

  if (!file || file.size === 0) {
    return { error: 'Nenhum arquivo selecionado.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'Arquivo muito grande. Maximo permitido: 50 MB.' }
  }

  if (!clienteId) {
    return { error: 'Cliente nao informado.' }
  }

  const cat: CategoriaDocumento = CATEGORIAS_VALIDAS.includes(categoria as CategoriaDocumento)
    ? (categoria as CategoriaDocumento)
    : 'outro'

  // Upload para o Storage
  const uploadResult = await uploadFile(file, clienteId)
  if ('error' in uploadResult) {
    return { error: uploadResult.error }
  }

  // Inserir registro no banco
  const [doc] = await db
    .insert(documentos)
    .values({
      clienteId,
      nome: file.name,
      categoria: cat,
      tamanhoBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      storagePath: uploadResult.path,
      uploadPorId: currentUser.id,
      uploadPorNome: currentUser.nome,
      notas: notas?.trim() || null,
    })
    .returning({ id: documentos.id })

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/documentos')

  return { data: { id: doc.id } }
}

export async function listarDocumentos(clienteId?: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return []
  }

  const query = clienteId
    ? db
        .select({
          id: documentos.id,
          clienteId: documentos.clienteId,
          clienteNome: clientes.nome,
          nome: documentos.nome,
          categoria: documentos.categoria,
          tamanhoBytes: documentos.tamanhoBytes,
          mimeType: documentos.mimeType,
          storagePath: documentos.storagePath,
          uploadPorNome: documentos.uploadPorNome,
          notas: documentos.notas,
          createdAt: documentos.createdAt,
        })
        .from(documentos)
        .innerJoin(clientes, eq(documentos.clienteId, clientes.id))
        .where(eq(documentos.clienteId, clienteId))
        .orderBy(desc(documentos.createdAt))
    : db
        .select({
          id: documentos.id,
          clienteId: documentos.clienteId,
          clienteNome: clientes.nome,
          nome: documentos.nome,
          categoria: documentos.categoria,
          tamanhoBytes: documentos.tamanhoBytes,
          mimeType: documentos.mimeType,
          storagePath: documentos.storagePath,
          uploadPorNome: documentos.uploadPorNome,
          notas: documentos.notas,
          createdAt: documentos.createdAt,
        })
        .from(documentos)
        .innerJoin(clientes, eq(documentos.clienteId, clientes.id))
        .orderBy(desc(documentos.createdAt))

  return query
}

export async function atualizarDocumento(
  id: string,
  dados: { nome?: string; notas?: string | null }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  if (!id) {
    return { error: 'ID do documento nao informado.' }
  }

  const updates: Record<string, unknown> = {}
  if (dados.nome !== undefined && dados.nome.trim()) {
    updates.nome = dados.nome.trim()
  }
  if (dados.notas !== undefined) {
    updates.notas = dados.notas?.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'Nenhum campo para atualizar.' }
  }

  const doc = await db.query.documentos.findFirst({
    where: eq(documentos.id, id),
  })

  if (!doc) {
    return { error: 'Documento nao encontrado.' }
  }

  await db.update(documentos).set(updates).where(eq(documentos.id, id))

  revalidatePath(`/clientes/${doc.clienteId}`)
  revalidatePath('/documentos')

  return { data: { id } }
}

export async function deletarDocumento(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  // Buscar o documento para pegar o storagePath
  const doc = await db.query.documentos.findFirst({
    where: eq(documentos.id, id),
  })

  if (!doc) {
    return { error: 'Documento nao encontrado.' }
  }

  // Remover do Storage
  const deleteResult = await deleteFile(doc.storagePath)
  if ('error' in deleteResult) {
    // Log mas nao bloqueia — remove do DB de qualquer forma
    console.error('[documentos] storage delete failed:', deleteResult.error)
  }

  // Remover do banco
  await db.delete(documentos).where(eq(documentos.id, id))

  revalidatePath(`/clientes/${doc.clienteId}`)
  revalidatePath('/documentos')

  return { data: { id } }
}

export async function getUrlDocumento(id: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'Sessao expirada. Faca login novamente.' }
  }

  const doc = await db.query.documentos.findFirst({
    where: eq(documentos.id, id),
  })

  if (!doc) {
    return { error: 'Documento nao encontrado.' }
  }

  const result = await getSignedUrl(doc.storagePath)
  if ('error' in result) {
    return { error: result.error }
  }

  return { data: { url: result.url } }
}
