// Aplicação PONTUAL da migration 0044 (coluna clientes.logo_url) — na mão,
// via DIRECT_URL. Mesmo motivo das demais: a __drizzle_migrations do banco está
// vazia (histórico aplicado pelo editor SQL), então `drizzle-kit migrate` faria
// replay desde a 0000.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0044.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error(
      'DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0044.ts',
    )
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    const [jaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes'
        AND column_name = 'logo_url'
    `
    if (jaExiste) {
      console.log('clientes.logo_url JA existe — 0044 ja aplicada. Nada a fazer.')
      return
    }

    const arquivo = join(process.cwd(), 'drizzle', '0044_cliente_logo.sql')
    const conteudo = readFileSync(arquivo, 'utf8')
    await sql.unsafe(conteudo)

    const [confirma] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes'
        AND column_name = 'logo_url'
    `
    console.log(
      confirma
        ? 'OK: migration 0044 aplicada — coluna clientes.logo_url criada.'
        : 'ERRO: coluna nao encontrada apos aplicar. Verifique.',
    )
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
