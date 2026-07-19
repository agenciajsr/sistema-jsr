// Aplicação PONTUAL da migration 0037 (follow-up do CRM) — na mão, em
// transação, via DIRECT_URL. Faz DUAS coisas, ambas idempotentes:
//   1. Colunas crm_oportunidades.followup_nivel / ultimo_followup_em
//      (SQL de drizzle/0037_crm_followup.sql).
//   2. Seed da etapa "Follow-up" no pipeline Vendas PADRÃO do workspace 'jsr',
//      logo após 'Contato Feito' (ordem 2, probabilidade 25) — empurra as
//      ordens >= 2 antes de inserir. Só roda se ainda não existir etapa cujo
//      nome normalizado seja 'follow-up' nesse pipeline.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0037.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/aplicar-migration-0037.ts')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Conferir o estado REAL do banco antes (o STATE.md já mentiu uma vez).
    // Pré-requisito: tabelas do CRM da 0019 aplicadas.
    const [temTabela] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'crm_oportunidades'
    `
    if (!temTabela) {
      console.error('ABORTADO: tabela crm_oportunidades ausente — aplique a 0019 ANTES da 0037. Nada foi alterado.')
      process.exit(1)
    }

    // --- Parte 1: colunas (pula se já existirem — re-rodar é seguro) ---
    const colunas = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_oportunidades'
        AND column_name IN ('followup_nivel', 'ultimo_followup_em')
    `
    if (colunas.length === 2) {
      console.log('Colunas followup_nivel/ultimo_followup_em JA existem — pulando o SQL das colunas.')
    } else {
      const arquivo = join(process.cwd(), 'drizzle', '0037_crm_followup.sql')
      const conteudo = readFileSync(arquivo, 'utf8')
      const statements = conteudo
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean)

      console.log(`Aplicando ${statements.length} statement(s) de colunas em transacao...`)
      await sql.begin(async (tx) => {
        for (const [i, stmt] of statements.entries()) {
          console.log(`  [${i + 1}/${statements.length}] ${stmt.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 70)}...`)
          await tx.unsafe(stmt)
        }
      })
      console.log('OK: colunas followup_nivel e ultimo_followup_em criadas (nullable, sem backfill).')
    }

    // --- Parte 2: seed da etapa "Follow-up" no pipeline Vendas padrao ---
    const [pipeline] = await sql`
      SELECT p.id FROM crm_pipelines p
      JOIN workspaces w ON w.id = p.workspace_id AND w.slug = 'jsr'
      WHERE p.padrao = true
      LIMIT 1
    `
    if (!pipeline) {
      console.log('AVISO: pipeline padrao do workspace jsr nao encontrado — seed da etapa Follow-up PULADO.')
    } else {
      // Normalizacao equivalente a ehEtapaFollowup: sem acento/caixa/hifen/espaco.
      const [jaExiste] = await sql`
        SELECT 1 AS ok FROM crm_etapas
        WHERE pipeline_id = ${pipeline.id}
          AND replace(replace(lower(unaccent(nome)), '-', ''), ' ', '') = 'followup'
      `.catch(async () => {
        // Extensao unaccent pode nao existir: cai na comparacao sem acento manual
        // (os nomes esperados 'Follow-up'/'follow up' nao tem acento mesmo).
        return sql`
          SELECT 1 AS ok FROM crm_etapas
          WHERE pipeline_id = ${pipeline.id}
            AND replace(replace(lower(nome), '-', ''), ' ', '') = 'followup'
        `
      })

      if (jaExiste) {
        console.log('Etapa "Follow-up" JA existe no pipeline Vendas padrao — seed pulado.')
      } else {
        // UPDATE + INSERT atomicos: empurra as ordens >= 2 e insere na posicao 2
        // (logo apos 'Contato Feito', ordem 1).
        await sql.begin(async (tx) => {
          await tx`
            UPDATE crm_etapas SET ordem = ordem + 1
            WHERE pipeline_id = ${pipeline.id} AND ordem >= 2
          `
          await tx`
            INSERT INTO crm_etapas (pipeline_id, nome, ordem, probabilidade)
            VALUES (${pipeline.id}, 'Follow-up', 2, 25)
          `
        })
        console.log('OK: etapa "Follow-up" criada na ordem 2 (apos Contato Feito) do pipeline Vendas.')
      }
    }

    console.log('Migration 0037 aplicada com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar a 0037 (transacao revertida):', e)
  process.exit(1)
})
