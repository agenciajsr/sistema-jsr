// Aplicação PONTUAL da migration 0025 (Etapa 2 de /campanhas: tabelas
// demografia_insights e regiao_insights + coluna campaign_insights.objective) —
// na mão, em transação, via DIRECT_URL.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0025.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0025.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    const tabelas = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('demografia_insights', 'regiao_insights')
    `
    if (tabelas.length > 0) {
      console.error(`ABORTADO: ${tabelas.map((t) => t.table_name).join(', ')} JA existe(m) — a 0025 parece ja aplicada. Nada foi alterado.`)
      process.exit(1)
    }
    const [colObjective] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_insights' AND column_name = 'objective'
    `
    if (colObjective) {
      console.error('ABORTADO: campaign_insights.objective JA existe — a 0025 parece ja aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const arquivo = join(process.cwd(), 'drizzle', '0025_etapa2_campanhas.sql')
    const conteudo = readFileSync(arquivo, 'utf8')
    const statements = conteudo
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    console.log(`Aplicando ${statements.length} statements em transacao...`)
    await sql.begin(async (tx) => {
      for (const [i, stmt] of statements.entries()) {
        console.log(`  [${i + 1}/${statements.length}] ${stmt.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 70)}...`)
        await tx.unsafe(stmt)
      }
    })

    // Confirmação pós-aplicação.
    const confirmTabelas = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('demografia_insights', 'regiao_insights')
    `
    const [confirmCol] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaign_insights' AND column_name = 'objective'
    `
    console.log('Tabelas criadas:', confirmTabelas.map((t) => t.table_name).join(', '))
    console.log('Coluna campaign_insights.objective:', confirmCol ? 'OK' : 'AUSENTE')
    if (confirmTabelas.length < 2 || !confirmCol) {
      console.error('ERRO: confirmacao pos-aplicacao incompleta — verifique o banco.')
      process.exit(1)
    }

    console.log('Migration 0025 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0025 (transacao revertida):', e)
  process.exit(1)
})
