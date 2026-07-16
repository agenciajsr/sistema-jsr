// READ-ONLY: mostra as automações salvas (token mascarado) e o último lead.
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const rows = await sql`SELECT chave, ativo, config, updated_at FROM automacoes`
    for (const r of rows) {
      const c = (r.config ?? {}) as { token?: string; numeros?: string; mensagem?: string }
      console.log(`- ${r.chave} | ativo=${r.ativo} | token=${c.token ? c.token.slice(0, 6) + '...(' + c.token.length + ' chars)' : 'VAZIO'} | numeros=${c.numeros ?? '-'} | mensagem=${c.mensagem ? c.mensagem.slice(0, 40) + '...' : 'VAZIA'}`)
    }
    if (rows.length === 0) console.log('(nenhuma automacao salva)')
    const [ultimo] = await sql`SELECT created_at, fonte, status FROM crm_lead_inbox ORDER BY created_at DESC LIMIT 1`
    console.log('Ultimo lead:', ultimo?.created_at?.toISOString(), ultimo?.fonte, ultimo?.status)
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
