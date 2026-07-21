// Seed PONTUAL e idempotente do funil "Prospecção Fria" — na mão, em transação,
// via DIRECT_URL. Faz DUAS coisas, ambas idempotentes:
//   1. Cria o pipeline "Prospecção Fria" (workspace 'jsr') com 4 etapas ENXUTAS:
//      A Abordar(5%) → Abordado(10%) → Respondeu(25%) → Qualificado(40%).
//   2. Migra os frios já existentes (origem 'prospeccao_fria', abertos, hoje no
//      funil Vendas padrão) para o Frio na etapa "Abordado", carimbando
//      primeiro_contato_em SÓ quando ainda nulo (o disparo externo já saiu).
//
// POR QUE NÃO `drizzle-kit`: pipeline/etapas são DADOS (as tabelas crm_pipelines
// / crm_etapas já existem desde a 0019) — não há schema novo. Além disso, a
// tabela drizzle.__drizzle_migrations do banco está VAZIA (histórico aplicado
// pelo editor SQL do Supabase), então `drizzle-kit migrate` faria replay desde
// a 0000 sobre os dados reais.
//
// IDEMPOTÊNCIA:
//   - Parte 1: pula o seed se já existir pipeline 'Prospecção Fria' no workspace.
//   - Parte 2: o próprio WHERE (pipeline_id = Vendas) deixa de casar as linhas
//     depois de movidas → re-rodar afeta 0 linhas e não re-carimba a data.
//
// Rodar: npx tsx --env-file=.env.local scripts/seed-prospeccao-fria.ts

import postgres from 'postgres'

const NOME_PIPELINE_FRIO = 'Prospecção Fria'
const ETAPA_ABORDADO = 'Abordado'

// Etapas do Frio na ordem travada (nomes pt-BR EXATOS, com acento).
const ETAPAS_FRIO = [
  { nome: 'A Abordar', ordem: 0, probabilidade: 5 },
  { nome: 'Abordado', ordem: 1, probabilidade: 10 },
  { nome: 'Respondeu', ordem: 2, probabilidade: 25 },
  { nome: 'Qualificado', ordem: 3, probabilidade: 40 },
] as const

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error(
      'DIRECT_URL nao definida. Rode com: npx tsx --env-file=.env.local scripts/seed-prospeccao-fria.ts'
    )
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })

  try {
    // Pré-requisito: tabelas do CRM da 0019 aplicadas (conferir o banco REAL).
    const [temTabela] = await sql`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'crm_oportunidades'
    `
    if (!temTabela) {
      console.error(
        'ABORTADO: tabela crm_oportunidades ausente — aplique a 0019 ANTES. Nada foi alterado.'
      )
      process.exit(1)
    }

    // Workspace alvo. Ausente = ambiente sem 'jsr' seedado: avisa e sai sem erro.
    const [workspace] = await sql`SELECT id FROM workspaces WHERE slug = 'jsr' LIMIT 1`
    if (!workspace) {
      console.log("AVISO: workspace slug 'jsr' nao encontrado — seed PULADO. Nada foi alterado.")
      return
    }
    const workspaceId = workspace.id as string

    // --- Parte 1: seed idempotente do pipeline Frio + 4 etapas ---
    let [pipelineFrio] = await sql`
      SELECT id FROM crm_pipelines
      WHERE workspace_id = ${workspaceId} AND nome = ${NOME_PIPELINE_FRIO}
      LIMIT 1
    `
    if (pipelineFrio) {
      console.log(`Pipeline "${NOME_PIPELINE_FRIO}" JA existe — seed pulado. (id: ${pipelineFrio.id})`)
    } else {
      pipelineFrio = await sql.begin(async (tx) => {
        const [criado] = await tx`
          INSERT INTO crm_pipelines (workspace_id, nome, ordem, padrao)
          VALUES (
            ${workspaceId},
            ${NOME_PIPELINE_FRIO},
            (SELECT COALESCE(MAX(ordem), 0) + 1 FROM crm_pipelines WHERE workspace_id = ${workspaceId}),
            false
          )
          RETURNING id
        `
        for (const etapa of ETAPAS_FRIO) {
          await tx`
            INSERT INTO crm_etapas (pipeline_id, nome, ordem, probabilidade)
            VALUES (${criado.id}, ${etapa.nome}, ${etapa.ordem}, ${etapa.probabilidade})
          `
        }
        return criado
      })
      console.log(
        `OK: pipeline "${NOME_PIPELINE_FRIO}" criado com 4 etapas (A Abordar 5% → Abordado 10% → Respondeu 25% → Qualificado 40%). (id: ${pipelineFrio.id})`
      )
    }
    const pipelineFrioId = pipelineFrio.id as string

    // --- Parte 2: migração idempotente dos frios Vendas → Frio/"Abordado" ---
    const [pipelineVendas] = await sql`
      SELECT id FROM crm_pipelines
      WHERE workspace_id = ${workspaceId} AND padrao = true
      LIMIT 1
    `
    if (!pipelineVendas) {
      console.log('AVISO: pipeline padrao (Vendas) nao encontrado — migracao dos frios PULADA.')
      console.log('Seed do pipeline Frio concluido (sem migracao).')
      return
    }

    const [etapaAbordado] = await sql`
      SELECT id FROM crm_etapas
      WHERE pipeline_id = ${pipelineFrioId} AND nome = ${ETAPA_ABORDADO}
      LIMIT 1
    `
    if (!etapaAbordado) {
      console.error(
        `ABORTADO: etapa "${ETAPA_ABORDADO}" nao encontrada no pipeline Frio. Nada foi migrado.`
      )
      process.exit(1)
    }

    // Move os frios abertos que ainda estao no funil Vendas. O WHERE por
    // pipeline_id = Vendas garante idempotencia: apos mover, essas linhas saem
    // do Vendas e re-rodar nao casa nada (0 linhas). primeiro_contato_em so e
    // carimbado quando nulo (COALESCE preserva o original). ordem_na_etapa
    // sequencial via row_number (0-based) na propria selecao.
    const movidos = await sql`
      WITH alvo AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS nova_ordem
        FROM crm_oportunidades
        WHERE workspace_id = ${workspaceId}
          AND pipeline_id = ${pipelineVendas.id}
          AND origem = 'prospeccao_fria'
          AND status = 'aberta'
      )
      UPDATE crm_oportunidades o
      SET pipeline_id = ${pipelineFrioId},
          etapa_id = ${etapaAbordado.id},
          primeiro_contato_em = COALESCE(o.primeiro_contato_em, now()),
          ordem_na_etapa = alvo.nova_ordem,
          updated_at = now()
      FROM alvo
      WHERE o.id = alvo.id
      RETURNING o.id
    `
    console.log(
      `OK: ${movidos.length} frio(s) movido(s) de Vendas → "${NOME_PIPELINE_FRIO}"/"${ETAPA_ABORDADO}" (esperado ~14 na 1a execucao, 0 nas seguintes).`
    )

    console.log('Seed "Prospecção Fria" aplicado com sucesso.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha ao aplicar o seed de Prospeccao Fria (transacao revertida):', e)
  process.exit(1)
})
