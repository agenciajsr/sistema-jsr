// Teste PONTUAL: envia uma mensagem via WaScript com o token salvo na automacao.
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const [row] = await sql`SELECT config FROM automacoes WHERE chave = 'aviso_lead_novo'`
    const c = row.config as { token: string; numeros: string }
    const url = new URL(`https://api-whatsapp.wascript.com.br/api/enviar-texto/${c.token}`)
    url.searchParams.set('phone', c.numeros.trim().replace(/\D/g, ''))
    url.searchParams.set('message', 'Teste do Sistema JSR — se você recebeu isto, a automação está OK ✅')
    const res = await fetch(url)
    console.log('HTTP', res.status)
    console.log(await res.text())
  } finally {
    await sql.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
