// PONTUAL (18/jul/2026): semeia o modelo de SAÍDA do cliente (offboarding) em
// processo_modelo_itens. Idempotente: só insere se não houver itens tipo 'saida'.
// Uso: npx tsx --env-file=.env.local scripts/seed-modelo-saida.ts
import postgres from 'postgres'

const MODELO_SAIDA = [
  { titulo: 'Comunicar o encerramento ao cliente (formalizar por escrito)', opcional: false },
  { titulo: 'Pausar/encerrar as campanhas ativas', opcional: false },
  { titulo: 'Backup dos criativos e relatórios na pasta do Drive', opcional: false },
  { titulo: 'Revogar acessos (contas de anúncio, ferramentas)', opcional: false },
  { titulo: 'Encerrar cobranças futuras', opcional: false },
  { titulo: 'Sair/arquivar o grupo do WhatsApp', opcional: true },
  { titulo: 'Registrar o motivo da saída (aprendizado p/ retenção)', opcional: false },
]

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const [{ total }] = await sql`
      SELECT count(*)::int AS total FROM processo_modelo_itens WHERE tipo = 'saida'
    `
    if (total > 0) {
      console.log(`Modelo de saída já tem ${total} itens — nada a fazer.`)
      return
    }
    for (const [i, item] of MODELO_SAIDA.entries()) {
      await sql`
        INSERT INTO processo_modelo_itens (tipo, titulo, ordem, opcional)
        VALUES ('saida', ${item.titulo}, ${i}, ${item.opcional})
      `
    }
    console.log(`Seed: ${MODELO_SAIDA.length} itens de saída criados.`)
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
