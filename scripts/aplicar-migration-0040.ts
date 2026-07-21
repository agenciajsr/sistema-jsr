// Migration 0040 — coluna `interno` em clientes (aditiva, idempotente).
// Perfil interno = a própria agência (perfil mãe): vê tráfego/campanhas, mas
// fica fora das métricas de negócio.
//
// POR QUE NÃO `drizzle-kit migrate`: a tabela drizzle.__drizzle_migrations do
// banco está VAZIA (histórico aplicado pelo editor SQL do Supabase), então o
// comando faria replay desde a 0000 sobre os dados reais.
//
// Uso: npx tsx --env-file=.env.local scripts/aplicar-migration-0040.ts
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    // `clientes` é tabela QUENTE (dashboard/listas/cron fazem SELECT direto). O
    // ADD COLUMN precisa de ACCESS EXCLUSIVE, que conflita com qualquer SELECT.
    // Técnica de baixa contenção: lock_timeout CURTO + muitas tentativas rápidas
    // — o ALTER "fura" o lock numa micro-brecha entre queries (a operação em si é
    // metadata-only/instantânea, PG11+), sem ficar bloqueando o tráfego na fila.
    await sql`SET lock_timeout = '400ms'`
    await sql`SET statement_timeout = '30s'`
    const MAX = 60
    let ok = false
    for (let tentativa = 1; tentativa <= MAX && !ok; tentativa++) {
      try {
        await sql`
          ALTER TABLE "clientes"
          ADD COLUMN IF NOT EXISTS "interno" boolean NOT NULL DEFAULT false
        `
        ok = true
      } catch (e) {
        const code = (e as { code?: string })?.code
        if ((code === '55P03' || code === '57014') && tentativa < MAX) {
          if (tentativa % 10 === 0) console.log(`...ainda disputando o lock (tentativa ${tentativa}/${MAX})`)
          await new Promise((r) => setTimeout(r, 700))
          continue
        }
        throw e
      }
    }
    if (!ok) throw new Error('Não consegui o lock em clientes após várias tentativas')
    console.log('Migration 0040 aplicada: coluna clientes.interno (boolean, default false)')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
