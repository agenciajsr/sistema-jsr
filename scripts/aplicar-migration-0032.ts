// Aplicação PONTUAL da migration 0032 (clientes.asaas_customer_id + tabela
// cobrancas) — na mão, em transação, via DIRECT_URL.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// ORDEM: aplicar a 0029, 0030 e 0031 ANTES desta.
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0032.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0032.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    // Pré-requisito: coluna da 0031 aplicada.
    const [anterior] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contratos'
        AND column_name = 'servicos'
    `
    if (!anterior) {
      console.error('ABORTADO: contratos.servicos ausente — aplique a 0031 ANTES da 0032. Nada foi alterado.')
      process.exit(1)
    }

    const [jaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'cobrancas'
    `
    if (jaExiste) {
      console.error('ABORTADO: tabela cobrancas JA existe — a 0032 parece ja aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const arquivo = join(process.cwd(), 'drizzle', '0032_cobrancas_asaas.sql')
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
    const [coluna] = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes'
        AND column_name = 'asaas_customer_id'
    `
    const [tabela] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'cobrancas'
    `
    const [indice] = await sql`
      SELECT 1 AS ok FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'cobrancas_contrato_competencia_uniq'
    `
    if (!coluna || !tabela || !indice) {
      console.error('ERRO: confirmacao pos-aplicacao incompleta — verifique o banco.')
      process.exit(1)
    }
    console.log('OK: clientes.asaas_customer_id, tabela cobrancas e indice unico parcial criados.')
    console.log('Migration 0032 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0032 (transacao revertida):', e)
  process.exit(1)
})
