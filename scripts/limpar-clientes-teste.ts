// Limpeza dos clientes de teste (18/jul/2026):
//   - Jacson Ribeiro Sandbox (158c1eb1-8071-4e06-9dc8-1d0d41ecf4ab)
//   - Jacson Silva [TESTE]   (b0668e27-9f2a-47c0-9b76-d42a06e0ba69)
// Remove os clientes e tudo que depende deles (contratos, cobranças, transações,
// relatórios, tarefas, alertas, documentos, itens de processo/checklist, contas de
// anúncio e insights). Backup JSON de tudo antes; transação única.
//
// Dry-run (padrão):  npx tsx --env-file=.env.local scripts/limpar-clientes-teste.ts
// Executar de fato:  npx tsx --env-file=.env.local scripts/limpar-clientes-teste.ts --executar

import postgres from 'postgres'
import { writeFileSync } from 'node:fs'

const CLIENTES_TESTE = [
  '158c1eb1-8071-4e06-9dc8-1d0d41ecf4ab', // Jacson Ribeiro Sandbox
  'b0668e27-9f2a-47c0-9b76-d42a06e0ba69', // Jacson Silva [TESTE]
]

async function main() {
  const executar = process.argv.includes('--executar')
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const alvos = await sql`SELECT id, nome FROM clientes WHERE id IN ${sql(CLIENTES_TESTE)}`
    if (alvos.length !== 2) throw new Error(`Esperava 2 clientes de teste, achei ${alvos.length}. Abortando.`)
    console.log('Apagando clientes:', alvos.map((a) => a.nome).join(' | '))

    const ids = CLIENTES_TESTE

    // Filhas diretas de clientes
    const diretas = [
      'acompanhamentos', 'ad_accounts', 'alertas', 'checklist_items', 'cobrancas',
      'contratos', 'documentos', 'preferencias_campanhas', 'processo_itens',
      'relatorio_configs', 'relatorios', 'tarefas', 'transacoes',
    ] as const

    const backup: Record<string, readonly unknown[]> = {}

    for (const t of diretas) {
      backup[t] = await sql.unsafe(
        `SELECT * FROM ${t} WHERE cliente_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`,
        ids,
      )
    }

    // Netas (dependem das filhas)
    const adAccountIds = (backup.ad_accounts as { id: string }[]).map((a) => a.id)
    const relatorioIds = (backup.relatorios as { id: string }[]).map((r) => r.id)
    const tarefaIds = (backup.tarefas as { id: string }[]).map((t) => t.id)

    backup.campaign_insights = adAccountIds.length
      ? await sql`SELECT * FROM campaign_insights WHERE ad_account_id IN ${sql(adAccountIds)}`
      : []
    backup.adset_insights = adAccountIds.length
      ? await sql`SELECT * FROM adset_insights WHERE ad_account_id IN ${sql(adAccountIds)}`
      : []
    backup.ad_insights = adAccountIds.length
      ? await sql`SELECT * FROM ad_insights WHERE ad_account_id IN ${sql(adAccountIds)}`
      : []
    backup.demografia_insights = adAccountIds.length
      ? await sql`SELECT * FROM demografia_insights WHERE ad_account_id IN ${sql(adAccountIds)}`
      : []
    backup.regiao_insights = adAccountIds.length
      ? await sql`SELECT * FROM regiao_insights WHERE ad_account_id IN ${sql(adAccountIds)}`
      : []
    backup.relatorio_blocos = relatorioIds.length
      ? await sql`SELECT * FROM relatorio_blocos WHERE relatorio_id IN ${sql(relatorioIds)}`
      : []
    backup.tarefa_anexos = tarefaIds.length
      ? await sql`SELECT * FROM tarefa_anexos WHERE tarefa_id IN ${sql(tarefaIds)}`
      : []
    backup.tarefa_atividades = tarefaIds.length
      ? await sql`SELECT * FROM tarefa_atividades WHERE tarefa_id IN ${sql(tarefaIds)}`
      : []
    backup.tarefa_checklist_items = tarefaIds.length
      ? await sql`SELECT * FROM tarefa_checklist_items WHERE tarefa_id IN ${sql(tarefaIds)}`
      : []
    backup.tarefa_comentarios = tarefaIds.length
      ? await sql`SELECT * FROM tarefa_comentarios WHERE tarefa_id IN ${sql(tarefaIds)}`
      : []

    // CRM: não apaga contatos/oportunidades reais — só desvincula se apontarem p/ cliente teste
    const crmVinculos = await sql`
      SELECT 'crm_contatos' AS tabela, id::text FROM crm_contatos WHERE cliente_id IN ${sql(ids)}
      UNION ALL
      SELECT 'crm_oportunidades', id::text FROM crm_oportunidades WHERE cliente_id IN ${sql(ids)}
      UNION ALL
      SELECT 'crm_empresas', id::text FROM crm_empresas WHERE cliente_id IN ${sql(ids)}
    `

    backup.clientes = alvos

    console.log('\nSerá apagado:')
    for (const [t, rows] of Object.entries(backup)) {
      if ((rows as unknown[]).length) console.log(`  ${t}: ${(rows as unknown[]).length}`)
    }
    console.log(`  vínculos CRM a desvincular: ${crmVinculos.length}`)

    if (!executar) {
      console.log('\n(dry-run — nada foi apagado; rode com --executar para efetivar)')
      return
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `scripts/backup-limpeza-clientes-${ts}.json`
    writeFileSync(backupPath, JSON.stringify(backup, null, 2))
    console.log(`\nBackup salvo em ${backupPath}`)

    await sql.begin(async (tx) => {
      // netas primeiro
      if (adAccountIds.length) {
        await tx`DELETE FROM campaign_insights WHERE ad_account_id IN ${tx(adAccountIds)}`
        await tx`DELETE FROM adset_insights WHERE ad_account_id IN ${tx(adAccountIds)}`
        await tx`DELETE FROM ad_insights WHERE ad_account_id IN ${tx(adAccountIds)}`
        await tx`DELETE FROM demografia_insights WHERE ad_account_id IN ${tx(adAccountIds)}`
        await tx`DELETE FROM regiao_insights WHERE ad_account_id IN ${tx(adAccountIds)}`
      }
      if (relatorioIds.length) await tx`DELETE FROM relatorio_blocos WHERE relatorio_id IN ${tx(relatorioIds)}`
      if (tarefaIds.length) {
        await tx`DELETE FROM tarefa_anexos WHERE tarefa_id IN ${tx(tarefaIds)}`
        await tx`DELETE FROM tarefa_atividades WHERE tarefa_id IN ${tx(tarefaIds)}`
        await tx`DELETE FROM tarefa_checklist_items WHERE tarefa_id IN ${tx(tarefaIds)}`
        await tx`DELETE FROM tarefa_comentarios WHERE tarefa_id IN ${tx(tarefaIds)}`
      }
      // desvincular CRM
      await tx`UPDATE crm_contatos SET cliente_id = NULL WHERE cliente_id IN ${tx(ids)}`
      await tx`UPDATE crm_oportunidades SET cliente_id = NULL WHERE cliente_id IN ${tx(ids)}`
      await tx`UPDATE crm_empresas SET cliente_id = NULL WHERE cliente_id IN ${tx(ids)}`
      // filhas diretas
      for (const t of diretas) {
        await tx.unsafe(`DELETE FROM ${t} WHERE cliente_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids)
      }
      // clientes
      await tx`DELETE FROM clientes WHERE id IN ${tx(ids)}`
    })

    const restantes = await sql`SELECT nome, status FROM clientes ORDER BY nome`
    console.log('\nLimpeza concluída. Clientes restantes:')
    for (const r of restantes) console.log(`  ${r.nome} (${r.status})`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('Falha:', e)
  process.exit(1)
})
