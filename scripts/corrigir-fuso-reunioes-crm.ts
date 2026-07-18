// PONTUAL (18/jul/2026): corrige o fuso das reuniões do CRM gravadas ANTES do
// deploy do fix de fuso (quick-260718-k2n). O bug: criarReuniaoCrm montava
// data_inicio/data_fim com `new Date('YYYY-MM-DDTHH:MM')` SEM offset — na
// Vercel (UTC) o instante ficava 3h ATRASADO em relação ao pretendido
// (15:00 escolhido gravava 15:00Z = 12:00 BRT). A correção soma +3h.
//
// IMPORTANTE: o corte default é now() — rode este script ANTES de agendar
// reuniões novas pós-deploy do fix, ou ajuste o corte manualmente abaixo.
//
// Uso: npx tsx --env-file=.env.local scripts/corrigir-fuso-reunioes-crm.ts            (dry-run)
//      npx tsx --env-file=.env.local scripts/corrigir-fuso-reunioes-crm.ts --executar (grava)
import { writeFileSync } from 'node:fs'

import postgres from 'postgres'

async function main() {
  const executar = process.argv.includes('--executar')
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    // Corte: só reuniões criadas ANTES de agora (antes do deploy do fix).
    const corte = new Date()

    const alvo = await sql`
      SELECT id, titulo, data_inicio, data_fim, data_vencimento, created_at
      FROM crm_tarefas
      WHERE tipo = 'reuniao' AND created_at < ${corte}
      ORDER BY data_inicio
    `

    console.log(`Reuniões afetadas (criadas antes de ${corte.toISOString()}): ${alvo.length}\n`)
    const fmt = (d: Date | null) =>
      d ? new Date(d).toISOString() : '(nulo)'
    const mais3h = (d: Date | null) =>
      d ? new Date(new Date(d).getTime() + 3 * 60 * 60 * 1000).toISOString() : '(nulo)'
    for (const r of alvo) {
      console.log(` - ${r.titulo} [${r.id}]`)
      console.log(`     inicio: ${fmt(r.data_inicio)} -> ${mais3h(r.data_inicio)}`)
      console.log(`     fim:    ${fmt(r.data_fim)} -> ${mais3h(r.data_fim)}`)
      console.log(`     venc.:  ${fmt(r.data_vencimento)} -> ${mais3h(r.data_vencimento)}`)
    }

    if (!executar) {
      console.log('\nPrévia — nada alterado. Rode com --executar para gravar.')
      return
    }

    // Backup JSON antes de alterar (padrão dos backups em scripts/).
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `scripts/backup-fuso-reunioes-${timestamp}.json`
    writeFileSync(backupPath, JSON.stringify(alvo, null, 2))
    console.log(`\nBackup gravado em ${backupPath}`)

    await sql.begin(async (tx) => {
      const feitos = await tx`
        UPDATE crm_tarefas
        SET data_inicio = data_inicio + interval '3 hours',
            data_fim = data_fim + interval '3 hours',
            data_vencimento = data_vencimento + interval '3 hours'
        WHERE tipo = 'reuniao' AND created_at < ${corte}
        RETURNING id
      `
      console.log(`Reuniões corrigidas (+3h): ${feitos.length}`)
    })
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
