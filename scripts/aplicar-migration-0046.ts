// Aplicação PONTUAL da migration 0046 (coluna clientes.tags) — na mão, via
// DIRECT_URL. Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0046.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida.')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1 })
  try {
    const conteudo = readFileSync(join(process.cwd(), 'drizzle', '0046_cliente_tags.sql'), 'utf8')
    await sql.unsafe(conteudo)
    const [ok] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'tags'
    `
    console.log(ok ? 'OK: migration 0046 aplicada — clientes.tags criada.' : 'ERRO: coluna ausente.')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
