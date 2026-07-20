// Migration 0038 — clientes.data_encerramento (aditiva, idempotente).
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0038.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_encerramento date`
    console.log('Migration 0038 aplicada: clientes.data_encerramento')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
