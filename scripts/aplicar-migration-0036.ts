// Migration 0036 — clientes.motivo_encerramento (aditiva, idempotente).
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0036.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS motivo_encerramento text`
    console.log('Migration 0036 aplicada: clientes.motivo_encerramento')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
