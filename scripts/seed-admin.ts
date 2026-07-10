// scripts/seed-admin.ts — rodar uma vez: npx tsx scripts/seed-admin.ts
import { createClient } from '@supabase/supabase-js'

import { db } from '../src/lib/db'
import { profiles } from '../src/lib/db/schema'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!, // apenas servidor, nunca expor
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: process.env.SEED_ADMIN_EMAIL!,
    password: process.env.SEED_ADMIN_PASSWORD!,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error('createUser não retornou usuário')

  await db.insert(profiles).values({ id: data.user.id, nome: 'Admin', role: 'admin' })
  console.log(`Admin criado: ${data.user.email} (${data.user.id})`)
}

main()
