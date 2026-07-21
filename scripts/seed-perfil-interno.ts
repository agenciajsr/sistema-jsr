// Seed IDEMPOTENTE — cria o "perfil mãe" (a própria agência) e vincula a conta
// de anúncio da agência a ele. O cliente nasce com interno=true: aparece no
// Tráfego/Campanhas, mas fica fora das métricas de negócio (contagem, MRR, CAC).
//
// Idempotente: reexecutar não duplica (procura por nome; só vincula contas ainda
// sem cliente). NÃO mexe em schema (isso é a migration 0040).
//
// Uso: npx tsx --env-file=.env.local scripts/seed-perfil-interno.ts
import postgres from 'postgres'

const NOME_INTERNO = 'JSR (Agência)'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    // 1. Cliente interno (find-or-create por nome).
    let clienteId: string
    const [existente] = await sql`SELECT id FROM clientes WHERE nome = ${NOME_INTERNO} LIMIT 1`
    if (existente) {
      clienteId = existente.id as string
      await sql`UPDATE clientes SET interno = true WHERE id = ${clienteId} AND interno = false`
      console.log(`Cliente interno já existia: ${clienteId} (${NOME_INTERNO})`)
    } else {
      const [novo] = await sql`
        INSERT INTO clientes (nome, nicho, status, interno)
        VALUES (${NOME_INTERNO}, 'negocio_local', 'ativo', true)
        RETURNING id`
      clienteId = novo.id as string
      console.log(`Cliente interno criado: ${clienteId} (${NOME_INTERNO})`)
    }

    // 2. Vincula contas de anúncio Meta AINDA SEM cliente a ele. Hoje há exatamente
    //    uma ("CA - 001 Agencia JSR"). Só toca em cliente_id NULL — não rouba conta
    //    já vinculada a cliente real.
    const contas = await sql`
      UPDATE ad_accounts
      SET cliente_id = ${clienteId}, updated_at = now()
      WHERE cliente_id IS NULL AND plataforma = 'meta'
      RETURNING nome, meta_account_id`
    if (contas.length === 0) {
      console.log('Nenhuma conta Meta sem cliente para vincular (já estava vinculada?).')
    } else {
      for (const c of contas) console.log(`Vinculada: ${c.nome} (${c.meta_account_id}) → ${NOME_INTERNO}`)
    }
    console.log('Seed do perfil interno concluído.')
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
