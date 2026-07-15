// Aplicação PONTUAL da migration 0021 (crm_tags, crm_contato_tags e colunas de
// endereço em crm_contatos) — na mão, em transação, via DIRECT_URL.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0021.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0021.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    const [tagsJaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'crm_tags'
    `
    if (tagsJaExiste) {
      console.error('ABORTADO: a tabela crm_tags JA existe no banco — a 0021 parece ja aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const arquivo = join(process.cwd(), 'drizzle', '0021_crm_tags_lead_endereco.sql')
    const conteudo = readFileSync(arquivo, 'utf8')
    const statements = conteudo
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    console.log(`Aplicando ${statements.length} statements da 0021 em transacao...`)

    await sql.begin(async (tx) => {
      for (const [i, stmt] of statements.entries()) {
        console.log(`  [${i + 1}/${statements.length}] ${stmt.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 70)}...`)
        await tx.unsafe(stmt)
      }
    })

    // Confirmação pós-aplicação: tabelas e colunas novas.
    const tabelas = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('crm_tags', 'crm_contato_tags')
      ORDER BY table_name
    `
    const colunas = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_contatos'
        AND column_name IN ('pais', 'numero', 'complemento', 'bairro')
      ORDER BY column_name
    `
    console.log('Tabelas criadas:', tabelas.map((t) => t.table_name).join(', '))
    console.log('Colunas novas em crm_contatos:', colunas.map((c) => c.column_name).join(', '))

    if (tabelas.length !== 2 || colunas.length !== 4) {
      console.error('ERRO: confirmacao pos-aplicacao incompleta — verifique o banco.')
      process.exit(1)
    }

    console.log('Migration 0021 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0021 (transacao revertida):', e)
  process.exit(1)
})
