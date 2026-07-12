import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'documentos'

/**
 * Upload de arquivo para o bucket de documentos no Supabase Storage.
 * Retorna o storagePath (caminho dentro do bucket).
 */
export async function uploadFile(
  file: File,
  clienteId: string,
): Promise<{ path: string } | { error: string }> {
  const supabase = createAdminClient()

  // Gera um nome unico para evitar colisoes
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${clienteId}/${timestamp}-${safeName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('[storage] upload error:', error.message)
    return { error: `Falha no upload: ${error.message}` }
  }

  return { path: storagePath }
}

/**
 * Gera uma URL assinada (temporaria) para download/visualizacao.
 * Valida por 1 hora (3600s).
 */
export async function getSignedUrl(
  storagePath: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) {
    return { error: 'Nao foi possivel gerar o link de download.' }
  }

  return { url: data.signedUrl }
}

/**
 * Remove um arquivo do bucket de documentos.
 */
export async function deleteFile(
  storagePath: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (error) {
    console.error('[storage] delete error:', error.message)
    return { error: `Falha ao remover arquivo: ${error.message}` }
  }

  return { success: true }
}
