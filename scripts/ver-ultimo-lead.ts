// READ-ONLY: mostra os últimos leads que caíram no inbox e no contato, com o
// payload cru — para conferir o que o webhook da landing enviou de verdade.
//
// Rodar: npx tsx --env-file=.env.local scripts/ver-ultimo-lead.ts

import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com --env-file=.env.local')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1 })
  try {
    console.log('=== Últimas 5 entradas em crm_lead_inbox ===')
    const inbox = await sql`
      SELECT created_at, fonte, status, payload
      FROM crm_lead_inbox
      ORDER BY created_at DESC
      LIMIT 5
    `
    for (const r of inbox) {
      console.log(`\n[${r.created_at?.toISOString?.() ?? r.created_at}] fonte=${r.fonte} status=${r.status ?? '-'}`)
      console.log(JSON.stringify(r.payload, null, 2))
    }
    if (inbox.length === 0) console.log('(vazio — nada chegou no inbox)')

    console.log('\n=== Últimos 3 contatos criados (nome/origem/detalhe) ===')
    const contatos = await sql`
      SELECT created_at, nome, telefone, email, origem, origem_detalhe
      FROM crm_contatos
      ORDER BY created_at DESC
      LIMIT 3
    `
    for (const c of contatos) {
      console.log(`\n[${c.created_at?.toISOString?.() ?? c.created_at}] ${c.nome} | tel=${c.telefone ?? '-'} | email=${c.email ?? '-'} | origem=${c.origem}`)
      console.log('origem_detalhe:', JSON.stringify(c.origem_detalhe, null, 2))
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha:', e)
  process.exit(1)
})
