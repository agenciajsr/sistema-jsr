'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/storage/client'

const nomeSchema = z.string().trim().min(1, 'Informe seu nome.')
const senhaSchema = z.string().min(8, 'A senha deve ter ao menos 8 caracteres.')
const MAX_FOTO_BYTES = 2 * 1024 * 1024 // 2 MB

/**
 * Envia a foto do próprio usuário (avatar do /perfil) para o bucket PÚBLICO
 * crm-fotos e grava a URL pública em profiles.foto_url. Path fixo por usuário
 * (perfis/{id}.{ext}) com upsert. Mesmo padrão da logo do cliente / foto do lead.
 */
export async function atualizarMinhaFoto(
  formData: FormData,
): Promise<{ data: { fotoUrl: string } } | { error: string }> {
  const current = await getCurrentUser()
  if (!current) return { error: 'Sessão expirada. Faça login novamente.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Nenhuma imagem selecionada.' }
  if (!file.type.startsWith('image/')) return { error: 'Envie uma imagem (JPG, PNG ou WebP).' }
  if (file.size > MAX_FOTO_BYTES) return { error: 'Imagem muito grande. Máximo: 2 MB.' }

  try {
    const ext =
      (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `perfis/${current.id}.${ext}`
    const upload = await uploadFile(file, current.id, { bucket: 'crm-fotos', path, upsert: true })
    if ('error' in upload) return { error: upload.error }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return { error: 'NEXT_PUBLIC_SUPABASE_URL não configurada.' }
    const fotoUrl = `${base}/storage/v1/object/public/crm-fotos/${upload.path}?v=${Date.now()}`

    await db.update(profiles).set({ fotoUrl }).where(eq(profiles.id, current.id))

    revalidatePath('/perfil')
    revalidatePath('/', 'layout')
    return { data: { fotoUrl } }
  } catch (e) {
    console.error('[atualizarMinhaFoto]', e)
    return { error: 'Não foi possível enviar a foto.' }
  }
}

/** Atualiza o próprio nome (profiles.nome) do usuário logado. */
export async function atualizarMeuNome(
  nome: string
): Promise<{ data: { nome: string } } | { error: string }> {
  const current = await getCurrentUser()
  if (!current) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const parsed = nomeSchema.safeParse(nome)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nome inválido.' }
  }

  try {
    await db
      .update(profiles)
      .set({ nome: parsed.data })
      .where(eq(profiles.id, current.id))
  } catch {
    return { error: 'Não foi possível salvar o nome. Tente novamente.' }
  }

  // Atualiza o nome exibido na sidebar (layout do grupo (app)).
  revalidatePath('/perfil')
  revalidatePath('/', 'layout')
  return { data: { nome: parsed.data } }
}

/**
 * Troca a própria senha via client de SESSÃO do usuário (não admin) —
 * supabase.auth.updateUser age sobre o usuário autenticado.
 */
export async function atualizarMinhaSenha(
  senha: string
): Promise<{ data: true } | { error: string }> {
  const current = await getCurrentUser()
  if (!current) {
    return { error: 'Sessão expirada. Faça login novamente.' }
  }

  const parsed = senhaSchema.safeParse(senha)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Senha inválida.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) {
    return { error: 'Não foi possível alterar a senha. Tente novamente.' }
  }

  return { data: true }
}
