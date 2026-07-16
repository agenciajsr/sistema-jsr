// Apaga as 3 linhas de preferencias_campanhas contaminadas antes da correção de
// estado do React (commit 79b09db) — decisão do usuário na Etapa 3 (15/jul/2026):
// elas voltam a nascer do PRESET do objetivo (Emílio->vendas, Yury->conversas,
// Ramon->leads), resultado melhor que o estado atual. Em transação, via DIRECT_URL.
//
// Rodar: npx tsx --env-file=.env.local scripts/limpar-preferencias-contaminadas.ts

import postgres from 'postgres'

const IDS_ALVO = [
  '936af6aa-e9d7-49ec-975e-6bc9ca3a5af1', // Yury igor marcello da silva
  '870d2775-c9b1-442c-b720-adde1ca36547', // Emilio Endler Neto
  '731148dc-dd6e-41cf-8284-49eaef9d72e4', // Ramon Souza Speck
]

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com --env-file=.env.local')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1 })
  try {
    await sql.begin(async (tx) => {
      const alvo = await tx`
        SELECT p.cliente_id, c.nome
        FROM preferencias_campanhas p
        JOIN clientes c ON c.id = p.cliente_id
        WHERE p.cliente_id IN ${sql(IDS_ALVO)}
      `
      console.log(`Encontradas ${alvo.length} linha(s) para apagar:`)
      for (const r of alvo) console.log(`  - ${r.nome} (${r.cliente_id})`)

      const del = await tx`
        DELETE FROM preferencias_campanhas
        WHERE cliente_id IN ${sql(IDS_ALVO)}
      `
      console.log(`\nApagadas: ${del.count} linha(s).`)
    })

    const [restantes] = await sql`SELECT count(*)::int AS n FROM preferencias_campanhas`
    console.log(`Restam ${restantes.n} linha(s) em preferencias_campanhas.`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha (transacao revertida):', e)
  process.exit(1)
})
