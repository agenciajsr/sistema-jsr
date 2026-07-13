'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'

const nomeSchema = z.string().trim().min(1, 'Informe seu nome.')
const senhaSchema = z.string().min(8, 'A senha deve ter ao menos 8 caracteres.')

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
