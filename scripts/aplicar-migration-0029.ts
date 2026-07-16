// Aplicação PONTUAL da migration 0029 (fluxo de contratos: token, status_fluxo,
// duracao_meses, servico, dados_contratante, dados_recebidos_em em contratos) —
// na mão, em transação, via DIRECT_URL. NUNCA usar drizzle-kit migrate.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0029.ts

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
      WHERE table_schema = 'public' AND table_name = 'contratos' AND column_name = 'token'
    `
    if (jaExiste) {
      console.error('ABORTADO: coluna token JA existe em contratos — 0029 parece aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const conteudo = readFileSync(join(process.cwd(), 'drizzle', '0029_contratos_fluxo.sql'), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(conteudo)
    })

    const [conf] = await sql`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contratos'
        AND column_name IN ('token','status_fluxo','duracao_meses','servico','dados_contratante','dados_recebidos_em')
    `
    if (!conf || conf.n !== 6) {
      console.error('ERRO: confirmacao pos-aplicacao falhou (esperava 6 colunas novas).')
      process.exit(1)
    }
    console.log('Migration 0029 aplicada com sucesso (6 colunas + unique do token em contratos).')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0029 (transacao revertida):', e)
  process.exit(1)
})
