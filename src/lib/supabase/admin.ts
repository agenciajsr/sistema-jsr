import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service-role (SERVER-ONLY).
 *
 * BYPASSA o Row-Level Security (RLS). Usar SOMENTE em código de servidor que já
 * está protegido por autenticação — ex.: server actions que checam getCurrentUser
 * antes de chamar operações de storage. A SUPABASE_SECRET_KEY NUNCA deve ser
 * exposta ao cliente (não usar NEXT_PUBLIC).
 *
 * Motivo: o bucket de documentos tem RLS ligado sem políticas de upload; como
 * todo acesso a arquivos passa por server actions autenticadas, o service-role
 * é a forma mais simples e segura de operar o storage nesta ferramenta interna.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
