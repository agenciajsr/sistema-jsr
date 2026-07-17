// Aplicação PONTUAL da migration 0034 (crm_oportunidades.primeiro_contato_em)
// — na mão, em transação, via DIRECT_URL.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0034.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0034.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    // Pré-requisito: tabela crm_oportunidades da 0019 aplicada.
    const [anterior] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'crm_oportunidades'
    `
    if (!anterior) {
      console.error('ABORTADO: tabela crm_oportunidades ausente — aplique a 0019 ANTES da 0034. Nada foi alterado.')
      process.exit(1)
    }

    const [jaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_oportunidades'
        AND column_name = 'primeiro_contato_em'
    `
    if (jaExiste) {
      console.error('ABORTADO: crm_oportunidades.primeiro_contato_em JA existe — a 0034 parece ja aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const arquivo = join(process.cwd(), 'drizzle', '0034_primeiro_contato.sql')
    const conteudo = readFileSync(arquivo, 'utf8')
    const statements = conteudo
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    console.log(`Aplicando ${statements.length} statement(s) em transacao...`)
    await sql.begin(async (tx) => {
      for (const [i, stmt] of statements.entries()) {
        console.log(`  [${i + 1}/${statements.length}] ${stmt.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 70)}...`)
        await tx.unsafe(stmt)
      }
    })

    // Confirmação pós-aplicação.
    const [coluna] = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_oportunidades'
        AND column_name = 'primeiro_contato_em'
    `
    if (!coluna) {
      console.error('ERRO: confirmacao pos-aplicacao incompleta — verifique o banco.')
      process.exit(1)
    }
    console.log('OK: crm_oportunidades.primeiro_contato_em criada (nullable, sem backfill — o carimbo nasce do uso).')
    console.log('Migration 0034 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0034 (transacao revertida):', e)
  process.exit(1)
})
