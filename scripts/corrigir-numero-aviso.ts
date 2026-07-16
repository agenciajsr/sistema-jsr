// PONTUAL: corrige o numero do aviso_lead_novo para o JID real (sem o nono digito).
import postgres from 'postgres'
async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const [r] = await sql`
      UPDATE automacoes
      SET config = jsonb_set(config, '{numeros}', '"557197371160"'), updated_at = now()
      WHERE chave = 'aviso_lead_novo'
      RETURNING config->>'numeros' AS numeros
    `
    console.log('Numero atualizado para:', r?.numeros)
  } finally { await sql.end() }
}
main().catch((e) => { console.error(e); process.exit(1) })
