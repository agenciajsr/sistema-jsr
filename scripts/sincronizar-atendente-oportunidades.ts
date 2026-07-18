// PONTUAL (17/jul/2026): a ficha salvava o atendente so no CONTATO; o card do
// kanban le da OPORTUNIDADE. Copia o dono do contato para os negocios ABERTOS
// que estao sem dono. Uso: npx tsx --env-file=.env.local scripts/sincronizar-atendente-oportunidades.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const feitos = await sql`
      UPDATE crm_oportunidades o
      SET dono_id = c.dono_id, updated_at = now()
      FROM crm_contatos c
      WHERE c.id = o.contato_id
        AND o.status = 'aberta'
        AND o.dono_id IS NULL
        AND c.dono_id IS NOT NULL
      RETURNING o.titulo
    `
    console.log(`Negocios sincronizados: ${feitos.length}`)
    for (const r of feitos) console.log(` - ${r.titulo}`)
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
