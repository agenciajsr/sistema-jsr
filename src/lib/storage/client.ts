import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'documentos'

/**
 * Upload de arquivo para o Supabase Storage.
 * Padrao: bucket de documentos com path unico `{pasta}/{timestamp}-{nome}`.
 * `opts` permite outro bucket/path fixo (ex.: foto do lead em crm-fotos com
 * upsert — a troca de foto SOBRESCREVE o mesmo path de proposito).
 * Retorna o storagePath (caminho dentro do bucket).
 */
export async function uploadFile(
  file: File,
  pasta: string,
  opts?: { bucket?: string; path?: string; upsert?: boolean },
): Promise<{ path: string } | { error: string }> {
  const supabase = createAdminClient()

  // Gera um nome unico para evitar colisoes (quando nao ha path fixo)
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = opts?.path ?? `${pasta}/${timestamp}-${safeName}`

  const { error } = await supabase.storage
    .from(opts?.bucket ?? BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: opts?.upsert ?? false,
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
