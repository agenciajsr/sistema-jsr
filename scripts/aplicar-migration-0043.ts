// Migration 0043 — tabela google_ads_credentials (aditiva, idempotente).
// Credenciais OAuth do Google Ads, separadas das da Agenda.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do banco
// está VAZIA (histórico aplicado pelo editor SQL do Supabase); o comando faria replay.
//
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0043.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "google_ads_credentials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text,
        "access_token" text,
        "refresh_token" text NOT NULL,
        "expiry" timestamp with time zone,
        "scope" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `
    console.log('Migration 0043 aplicada: tabela google_ads_credentials')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
