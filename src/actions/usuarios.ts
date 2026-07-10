'use server'

import { createClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { usuarioSchema, type UsuarioInput } from '@/lib/validations/usuario'

const MENSAGEM_ERRO_PADRAO =
  'Não foi possível salvar. Verifique os dados e tente novamente.'

export type CriarUsuarioState =
  | { data: { id: string; email: string } }
  | { error: string }

export async function criarUsuario(
  input: UsuarioInput
): Promise<CriarUsuarioState> {
  // D-02: apenas Admin pode criar novos usuários — checagem acontece antes de
  // qualquer chamada à Supabase Admin API.
  const admin = await requireAdmin()
  if ('error' in admin) {
    return { error: admin.error }
  }

  const parsed = usuarioSchema.safeParse(input)
  if (!parsed.success) {
    return { error: MENSAGEM_ERRO_PADRAO }
  }
  const { nome, email, senhaTemporaria, role } = parsed.data

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!, // apenas servidor, nunca expor
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senhaTemporaria,
    email_confirm: true,
  })

  if (error || !data.user) {
    return { error: MENSAGEM_ERRO_PADRAO }
  }

  try {
    await db.insert(profiles).values({ id: data.user.id, nome, role })
  } catch {
    return { error: MENSAGEM_ERRO_PADRAO }
  }

  return { data: { id: data.user.id, email: data.user.email ?? email } }
}
