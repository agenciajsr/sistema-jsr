// Script PONTUAL: cancela a cobrança duplicada da competência 2026-07 no
// Asaas sandbox (DELETE /payments/{id}) e marca status='cancelada' no banco.
// Rodar com: npx tsx --env-file=.env.local scripts/cancelar-cobranca-duplicada.ts
// (tsx não carrega .env.local sozinho — decisão registrada no STATE.)

import postgres from 'postgres'

import { cancelarCobranca } from '../src/lib/asaas/client'

const COBRANCA_ID = 'cba003b1-eddb-48c2-a05e-be6989510ea9'
const PAYMENT_ID = 'pay_alt9pinbxw0rlwaq'

async function main() {
  if (process.env.ASAAS_ENV === 'production') {
    console.error('ABORTADO: ASAAS_ENV=production — este script só roda contra o sandbox.')
    process.exit(1)
  }
  console.log(
    `Ambiente Asaas: ${process.env.ASAAS_ENV ?? '(vazio → sandbox)'} — baseUrl https://api-sandbox.asaas.com/v3`,
  )

  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('ABORTADO: DIRECT_URL não definida (rodar com --env-file=.env.local).')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1 })

  try {
    // (a) Estado atual da cobrança.
    const antes = await sql`
      select co.id, co.status, co.competencia, co.asaas_payment_id, cl.nome
      from cobrancas co
      join clientes cl on cl.id = co.cliente_id
      where co.id = ${COBRANCA_ID}
    `
    if (antes.length === 0) {
      console.error('ABORTADO: cobrança não encontrada no banco.')
      process.exit(1)
    }
    const c = antes[0]
    console.log(
      `Cobrança encontrada: cliente="${c.nome}" competência=${c.competencia} status=${c.status} payment=${c.asaas_payment_id}`,
    )
    if (c.status === 'cancelada') {
      console.log('Nada a fazer: a cobrança já está cancelada.')
      return
    }

    // (b) Cancelar no Asaas sandbox.
    try {
      await cancelarCobranca(PAYMENT_ID)
      console.log(`Asaas: payment ${PAYMENT_ID} cancelado (DELETE ok).`)
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro)
      if (/removid|deletad|cancelad|não encontrada|not found|404/i.test(msg)) {
        console.warn(`Aviso: Asaas indica que o pagamento já foi removido/cancelado (${msg}) — seguindo.`)
      } else {
        throw erro
      }
    }

    // (c) Marcar cancelada no banco.
    await sql`
      update cobrancas set status = 'cancelada', updated_at = now() where id = ${COBRANCA_ID}
    `

    // (d) Confirmação final.
    const depois = await sql`
      select status from cobrancas where id = ${COBRANCA_ID}
    `
    console.log(`Status final no banco: ${depois[0]?.status}`)
  } finally {
    await sql.end()
  }
}

main().catch((erro) => {
  console.error('ERRO:', erro)
  process.exit(1)
})
