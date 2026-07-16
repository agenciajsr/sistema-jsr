// Aplicação PONTUAL da migration 0033 (clientes.modo_cobranca) — na mão, em
// transação, via DIRECT_URL.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// ORDEM: aplicar a 0032 ANTES desta.
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0033.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0033.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    // Pré-requisito: tabela cobrancas da 0032 aplicada.
    const [anterior] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'cobrancas'
    `
    if (!anterior) {
      console.error('ABORTADO: tabela cobrancas ausente — aplique a 0032 ANTES da 0033. Nada foi alterado.')
      process.exit(1)
    }

    const [jaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clientes'
        AND column_name = 'modo_cobranca'
    `
    if (jaExiste) {
      console.error('ABORTADO: clientes.modo_cobranca JA existe — a 0033 parece ja aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const arquivo = join(process.cwd(), 'drizzle', '0033_modo_cobranca.sql')
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
        AND column_name = 'modo_cobranca'
    `
    if (!coluna) {
      console.error('ERRO: confirmacao pos-aplicacao incompleta — verifique o banco.')
      process.exit(1)
    }
    const [{ automaticos }] = await sql`
      SELECT count(*)::int AS automaticos FROM clientes WHERE modo_cobranca = 'automatico_asaas'
    `
    console.log(`OK: clientes.modo_cobranca criada; ${automaticos} cliente(s) backfillado(s) como automatico_asaas.`)
    console.log('Migration 0033 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0033 (transacao revertida):', e)
  process.exit(1)
})
