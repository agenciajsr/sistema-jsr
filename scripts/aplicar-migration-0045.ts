// Aplicação PONTUAL da migration 0045 (segmento, principal_servico, pastas em
// clientes + foto_url em profiles) — na mão, via DIRECT_URL. Mesmo motivo das
// demais: a __drizzle_migrations do banco está vazia.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0045.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error(
      'DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0045.ts',
    )
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    const arquivo = join(process.cwd(), 'drizzle', '0045_segmento_pastas_foto.sql')
    const conteudo = readFileSync(arquivo, 'utf8')
    await sql.unsafe(conteudo)

    const cols = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'clientes' AND column_name IN ('segmento','principal_servico','pastas'))
          OR (table_name = 'profiles' AND column_name = 'foto_url'))
      ORDER BY table_name, column_name
    `
    console.log(`OK: migration 0045 aplicada — ${cols.length}/4 colunas presentes:`)
    for (const c of cols) console.log(`  - ${c.table_name}.${c.column_name}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
