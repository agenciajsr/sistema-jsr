// READ-ONLY: lista as últimas entradas do inbox (data/fonte/status).
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const rows = await sql`SELECT created_at, fonte, status FROM crm_lead_inbox ORDER BY created_at DESC LIMIT 10`
    for (const r of rows) console.log(r.created_at.toISOString(), '|', r.fonte, '|', r.status)
    console.log(`Total exibido: ${rows.length}`)
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
