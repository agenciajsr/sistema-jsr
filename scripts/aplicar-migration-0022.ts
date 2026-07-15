// Aplicação PONTUAL da migration 0022 (foto do lead + atividades agendáveis +
// bucket crm-fotos) — na mão, em transação, via DIRECT_URL.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Os statements de `storage.*` (bucket + policies) rodam FORA da transação
// principal, um a um: em alguns projetos o role da conexão não tem permissão
// no schema storage — nesse caso as tabelas ficam aplicadas e o script imprime
// o SQL para colar no editor do Supabase (fallback documentado, não silencioso).
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0022.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0022.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    const [fotoJaExiste] = await sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_contatos' AND column_name = 'foto_url'
    `
    if (fotoJaExiste) {
      console.error('ABORTADO: crm_contatos.foto_url JA existe — a 0022 parece ja aplicada. Nada foi alterado.')
      process.exit(1)
    }

    const arquivo = join(process.cwd(), 'drizzle', '0022_crm_ficha_lead.sql')
    const conteudo = readFileSync(arquivo, 'utf8')
    const statements = conteudo
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)

    const deTabela = statements.filter((s) => !/\bstorage\./i.test(s))
    const deStorage = statements.filter((s) => /\bstorage\./i.test(s))

    console.log(`Aplicando ${deTabela.length} statements de tabela em transacao...`)
    await sql.begin(async (tx) => {
      for (const [i, stmt] of deTabela.entries()) {
        console.log(`  [${i + 1}/${deTabela.length}] ${stmt.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 70)}...`)
        await tx.unsafe(stmt)
      }
    })

    // storage.*: um a um, com fallback documentado se faltar permissão.
    const pendentes: string[] = []
    for (const stmt of deStorage) {
      const resumo = stmt.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 70)
      try {
        await sql.unsafe(stmt)
        console.log(`  [storage OK] ${resumo}...`)
      } catch (e) {
        console.warn(`  [storage FALHOU] ${resumo}... -> ${(e as Error).message}`)
        pendentes.push(stmt)
      }
    }

    // Confirmação pós-aplicação: colunas novas + bucket.
    const colunas = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'crm_contatos' AND column_name = 'foto_url') OR
        (table_name = 'crm_tarefas' AND column_name IN ('data_inicio', 'data_fim', 'prioridade'))
      )
      ORDER BY table_name, column_name
    `
    console.log('Colunas novas:', colunas.map((c) => `${c.table_name}.${c.column_name}`).join(', '))
    if (colunas.length !== 4) {
      console.error('ERRO: confirmacao pos-aplicacao incompleta — verifique o banco.')
      process.exit(1)
    }

    try {
      const [bucket] = await sql`SELECT id, public FROM storage.buckets WHERE id = 'crm-fotos'`
      console.log('Bucket crm-fotos:', bucket ? `existe (public=${bucket.public})` : 'NAO existe')
    } catch {
      console.warn('Nao foi possivel consultar storage.buckets com este role.')
    }

    if (pendentes.length > 0) {
      console.warn('\nATENCAO: cole os statements abaixo no editor SQL do Supabase (permissao insuficiente aqui):\n')
      for (const stmt of pendentes) console.warn(stmt + ';\n')
    }

    console.log('Migration 0022 aplicada (tabelas OK).')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0022 (transacao revertida):', e)
  process.exit(1)
})
