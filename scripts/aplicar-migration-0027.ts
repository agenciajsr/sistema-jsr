// Aplicação PONTUAL da migration 0027 (tabela automacoes) — na mão, em
// transação, via DIRECT_URL. NUNCA usar drizzle-kit migrate.
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0027.ts

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
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'automacoes'
    `
    if (jaExiste) {
      console.error('ABORTADO: automacoes JA existe — 0027 parece aplicada.')
      process.exit(1)
    }
    const conteudo = readFileSync(join(process.cwd(), 'drizzle', '0027_automacoes.sql'), 'utf8')
    await sql.begin(async (tx) => { await tx.unsafe(conteudo) })
    const [conf] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'automacoes'
    `
    if (!conf) { console.error('ERRO: confirmacao falhou.'); process.exit(1) }
    console.log('Migration 0027 aplicada com sucesso (tabela automacoes).')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error('Falha (transacao revertida):', e); process.exit(1) })
