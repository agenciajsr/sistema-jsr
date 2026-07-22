// Migration 0042 — coluna ad_accounts.forma_pagamento_manual (aditiva, idempotente).
// Forma de pagamento definida à mão pela equipe (o Meta não fornece — funding_source_details
// dá Permission Denied #10 e funding_source vem vazio).
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do banco está
// VAZIA (histórico aplicado pelo editor SQL do Supabase); o comando faria replay desde a 0000.
//
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0042.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql`ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "forma_pagamento_manual" text`
    console.log('Migration 0042 aplicada: coluna ad_accounts.forma_pagamento_manual')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
