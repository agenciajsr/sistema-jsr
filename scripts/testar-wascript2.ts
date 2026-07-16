import postgres from 'postgres'
async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })
  try {
    const [row] = await sql`SELECT config FROM automacoes WHERE chave = 'aviso_lead_novo'`
    const c = row.config as { token: string }
    const url = new URL(`https://api-whatsapp.wascript.com.br/api/enviar-texto/${c.token}`)
    url.searchParams.set('phone', '557197371160') // SEM o nono digito (JID real visto no webhook)
    url.searchParams.set('message', 'Teste 2 do Sistema JSR (numero sem o nono digito) ✅')
    const res = await fetch(url)
    console.log('HTTP', res.status, await res.text())
  } finally { await sql.end() }
}
main().catch((e) => { console.error(e); process.exit(1) })
