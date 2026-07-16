// Aplicação PONTUAL da migration 0028 (coluna cliente_id em crm_contatos) —
// na mão, em transação, via DIRECT_URL. NUNCA usar drizzle-kit migrate (o
// controle do Drizzle no banco está vazio; faria replay desde a 0000).
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0028.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com --env-file=.env.local')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1 })
  try {
    const [jaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_contatos' AND column_name = 'cliente_id'
    `
    if (jaExiste) {
      console.error('ABORTADO: coluna cliente_id JA existe em crm_contatos — 0028 parece aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const conteudo = readFileSync(join(process.cwd(), 'drizzle', '0028_crm_contatos_cliente_id.sql'), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(conteudo)
    })

    const [conf] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_contatos' AND column_name = 'cliente_id'
    `
    if (!conf) {
      console.error('ERRO: confirmacao pos-aplicacao falhou.')
      process.exit(1)
    }
    console.log('Migration 0028 aplicada com sucesso (coluna cliente_id + FK criadas em crm_contatos).')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0028 (transacao revertida):', e)
  process.exit(1)
})
