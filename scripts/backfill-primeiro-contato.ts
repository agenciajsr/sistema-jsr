// PONTUAL (17/jul/2026): carimba primeiro_contato_em nos leads antigos que
// obviamente JA tiveram contato — fechados (ganho/perdido) ou abertos fora da
// 1ª etapa do pipeline (alguem moveu o card na mao). Corrige os falsos
// "aguardando 1º contato" em Proposta/Negociação.
// Uso: npx tsx --env-file=.env.local scripts/backfill-primeiro-contato.ts [--aplicar]
import postgres from 'postgres'

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const alvo = await sql`
      SELECT o.id, o.titulo, o.status, e.nome AS etapa
      FROM crm_oportunidades o
      JOIN crm_etapas e ON e.id = o.etapa_id
      WHERE o.primeiro_contato_em IS NULL
        AND (
          o.status <> 'aberta'
          OR e.ordem > (SELECT min(e2.ordem) FROM crm_etapas e2 WHERE e2.pipeline_id = e.pipeline_id)
        )
    `
    console.log(`Leads a carimbar: ${alvo.length}`)
    for (const r of alvo) console.log(` - [${r.status}] ${r.etapa}: ${r.titulo}`)

    if (!aplicar) {
      console.log('\nPrevia (nada alterado). Rode com --aplicar para gravar.')
      return
    }

    await sql.begin(async (tx) => {
      const feitos = await tx`
        UPDATE crm_oportunidades o
        SET primeiro_contato_em = COALESCE(o.updated_at, now())
        FROM crm_etapas e
        WHERE e.id = o.etapa_id
          AND o.primeiro_contato_em IS NULL
          AND (
            o.status <> 'aberta'
            OR e.ordem > (SELECT min(e2.ordem) FROM crm_etapas e2 WHERE e2.pipeline_id = e.pipeline_id)
          )
        RETURNING o.id
      `
      console.log(`\nCarimbados: ${feitos.length}`)
    })
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
