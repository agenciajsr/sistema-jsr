// Migration 0039 — tabela investimentos_aquisicao (aditiva, idempotente).
// Investimento mensal em aquisição por canal → CAC por canal + LTV/CAC.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0039.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "investimentos_aquisicao" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "canal" text NOT NULL,
        "competencia" text NOT NULL,
        "valor" numeric(12, 2) NOT NULL,
        "notas" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_invest_canal_competencia"
      ON "investimentos_aquisicao" ("canal","competencia")
    `
    console.log('Migration 0039 aplicada: tabela investimentos_aquisicao + índice único (canal, competencia)')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
