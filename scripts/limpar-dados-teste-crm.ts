// Limpeza dos dados de teste do CRM (18/jul/2026).
// Mantém apenas os leads reais Daíla Aires e Dro anderson (contato + oportunidade +
// atividades + inbox). Todo o resto (contatos, oportunidades, atividades, tarefas,
// tags de contato, inbox, empresas órfãs) é removido.
//
// Dry-run (padrão):  npx tsx --env-file=.env.local scripts/limpar-dados-teste-crm.ts
// Executar de fato:  npx tsx --env-file=.env.local scripts/limpar-dados-teste-crm.ts --executar
//
// Antes de apagar, salva um backup JSON de todas as linhas removidas em
// scripts/backup-limpeza-crm-<timestamp>.json

import postgres from 'postgres'
import { writeFileSync } from 'node:fs'

const MANTER_CONTATOS = [
  'ccc86fdc-ede9-4e53-b64a-eb45ef71f925', // Daíla Aires
  'a0ed1403-730a-4a0c-80d5-73fde05c1ff4', // Dro anderson
]

async function main() {
  const executar = process.argv.includes('--executar')
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    // Conferência de segurança: os dois contatos a manter existem?
    const mantidos = await sql`SELECT id, nome FROM crm_contatos WHERE id IN ${sql(MANTER_CONTATOS)}`
    if (mantidos.length !== 2) {
      throw new Error(`Esperava 2 contatos a manter, achei ${mantidos.length}. Abortando.`)
    }
    console.log('Mantendo:', mantidos.map((m) => m.nome).join(' | '))

    const manterOps = await sql`SELECT id FROM crm_oportunidades WHERE contato_id IN ${sql(MANTER_CONTATOS)}`
    const manterOpsIds = manterOps.map((o) => o.id)
    console.log(`Oportunidades mantidas: ${manterOpsIds.length}`)

    // Seleciona tudo que será apagado (para backup e contagem)
    const contatosDel = await sql`SELECT * FROM crm_contatos WHERE id NOT IN ${sql(MANTER_CONTATOS)}`
    const opsDel = await sql`SELECT * FROM crm_oportunidades WHERE contato_id NOT IN ${sql(MANTER_CONTATOS)} OR contato_id IS NULL`
    const atividadesDel = await sql`
      SELECT * FROM crm_atividades a
      WHERE (a.contato_id IS NOT NULL AND a.contato_id NOT IN ${sql(MANTER_CONTATOS)})
         OR (a.oportunidade_id IS NOT NULL AND ${manterOpsIds.length > 0 ? sql`a.oportunidade_id NOT IN ${sql(manterOpsIds)}` : sql`TRUE`})
    `
    const tarefasDel = await sql`
      SELECT * FROM crm_tarefas t
      WHERE (t.contato_id IS NOT NULL AND t.contato_id NOT IN ${sql(MANTER_CONTATOS)})
         OR (t.oportunidade_id IS NOT NULL AND ${manterOpsIds.length > 0 ? sql`t.oportunidade_id NOT IN ${sql(manterOpsIds)}` : sql`TRUE`})
    `
    const tagsDel = await sql`SELECT * FROM crm_contato_tags WHERE contato_id NOT IN ${sql(MANTER_CONTATOS)}`
    const inboxDel = await sql`SELECT * FROM crm_lead_inbox WHERE contato_id IS NULL OR contato_id NOT IN ${sql(MANTER_CONTATOS)}`

    console.log(`\nSerão apagados:`)
    console.log(`  contatos:      ${contatosDel.length}`)
    console.log(`  oportunidades: ${opsDel.length}`)
    console.log(`  atividades:    ${atividadesDel.length}`)
    console.log(`  tarefas:       ${tarefasDel.length}`)
    console.log(`  contato_tags:  ${tagsDel.length}`)
    console.log(`  lead_inbox:    ${inboxDel.length}`)

    if (!executar) {
      console.log('\n(dry-run — nada foi apagado; rode com --executar para efetivar)')
      return
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `scripts/backup-limpeza-crm-${ts}.json`
    writeFileSync(
      backupPath,
      JSON.stringify(
        { contatos: contatosDel, oportunidades: opsDel, atividades: atividadesDel, tarefas: tarefasDel, contato_tags: tagsDel, lead_inbox: inboxDel },
        null,
        2,
      ),
    )
    console.log(`\nBackup salvo em ${backupPath}`)

    const contatosDelIds = contatosDel.map((c) => c.id)
    const opsDelIds = opsDel.map((o) => o.id)

    await sql.begin(async (tx) => {
      if (atividadesDel.length) await tx`DELETE FROM crm_atividades WHERE id IN ${tx(atividadesDel.map((a) => a.id))}`
      if (tarefasDel.length) await tx`DELETE FROM crm_tarefas WHERE id IN ${tx(tarefasDel.map((t) => t.id))}`
      if (tagsDel.length) await tx`DELETE FROM crm_contato_tags WHERE contato_id IN ${tx(contatosDelIds)}`
      if (inboxDel.length) await tx`DELETE FROM crm_lead_inbox WHERE id IN ${tx(inboxDel.map((i) => i.id))}`
      if (opsDelIds.length) await tx`DELETE FROM crm_oportunidades WHERE id IN ${tx(opsDelIds)}`
      if (contatosDelIds.length) await tx`DELETE FROM crm_contatos WHERE id IN ${tx(contatosDelIds)}`
      // Empresas que ficaram órfãs (sem nenhum contato/oportunidade/atividade apontando)
      await tx`
        DELETE FROM crm_empresas e
        WHERE NOT EXISTS (SELECT 1 FROM crm_contatos c WHERE c.empresa_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM crm_oportunidades o WHERE o.empresa_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM crm_atividades a WHERE a.empresa_id = e.id)
      `
    })

    // Conferência final
    const [c, o, i] = await Promise.all([
      sql`SELECT nome FROM crm_contatos`,
      sql`SELECT titulo FROM crm_oportunidades`,
      sql`SELECT count(*)::int AS n FROM crm_lead_inbox`,
    ])
    console.log('\nLimpeza concluída. Restaram:')
    console.log('  contatos:', c.map((x) => x.nome).join(' | '))
    console.log('  oportunidades:', o.map((x) => x.titulo).join(' | '))
    console.log('  lead_inbox:', i[0].n)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha:', e)
  process.exit(1)
})
