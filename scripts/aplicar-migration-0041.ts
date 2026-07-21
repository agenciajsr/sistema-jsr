// Migration 0041 — índice único parcial (transacao_pai_id, data) em transacoes.
// Trava de corrida da materialização recorrente do financeiro (quick-260721-ogt).
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// ⚠️ ORDEM: rodar a LIMPEZA (scripts/limpar-recorrentes-futuras.ts --apply) ANTES
// desta migration — duplicata (transacao_pai_id, data) faz o índice único falhar.
//
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0041.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_transacoes_pai_data"
        ON "transacoes" ("transacao_pai_id","data")
        WHERE "transacao_pai_id" IS NOT NULL
    `
    console.log('Migration 0041 aplicada: índice único parcial ux_transacoes_pai_data (transacao_pai_id, data)')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
