// Limpeza IDEMPOTENTE das instâncias recorrentes FUTURAS pré-geradas do
// financeiro (quick-260721-ogt). Antes, criar uma transação recorrente gerava
// todas as parcelas do futuro de uma vez (12 meses / ~27 semanas); agora a série
// ROLA mês a mês (rolarRecorrentes). Este script remove SÓ o futuro pré-gerado.
//
// A previsão continua BATENDO depois da limpeza porque getPrevisaoReceitaPorMes e
// getPrevisaoCaixa agora PROJETAM a série (a projeção é a fonte única do futuro
// recorrente). Rodar 2× é seguro (a 2ª vez não encontra nada).
//
// GERADO aqui, APLICADO pelo ORQUESTRADOR após revisão do dry-run.
// ⚠️ ORDEM: rodar esta limpeza (--apply) ANTES da migration 0041 (índice único)
// — remover as futuras reduz o risco de duplicata (transacao_pai_id, data)
// travar a criação do índice.
//
// Dry-run (padrão):  npx tsx --env-file=.env.local scripts/limpar-recorrentes-futuras.ts
// Aplicar de fato:   npx tsx --env-file=.env.local scripts/limpar-recorrentes-futuras.ts --apply
import postgres from 'postgres'

/** 'YYYY-MM' atual no fuso de Brasília (replica hojeBrasilia inline — standalone). */
function competenciaAtualBrasilia(): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return hoje.slice(0, 7)
}

async function main() {
  const aplicar = process.argv.includes('--apply')
  const competenciaAtual = competenciaAtualBrasilia()
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 })

  try {
    // Alvo: SÓ filhos recorrentes de competência FUTURA (> mês atual), pendentes
    // ou vencidos. NUNCA âncoras (pai NULL), NUNCA mês atual/passado, NUNCA pagos.
    const alvo = await sql`
      SELECT t.id, t.transacao_pai_id, t.descricao, t.data, t.tipo, t.valor, t.status,
             p.descricao AS ancora_descricao
      FROM transacoes t
      LEFT JOIN transacoes p ON p.id = t.transacao_pai_id
      WHERE t.transacao_pai_id IS NOT NULL
        AND t.recorrencia <> 'avulsa'
        AND to_char(t.data, 'YYYY-MM') > ${competenciaAtual}
        AND t.status IN ('pendente', 'vencido')
      ORDER BY p.descricao, t.data
    `

    console.log(`\nCompetência atual (Brasília): ${competenciaAtual}`)
    console.log(`Modo: ${aplicar ? 'APLICAR (DELETE real)' : 'DRY-RUN (nenhuma remoção)'}`)
    console.log(`Linhas futuras candidatas à remoção: ${alvo.length}\n`)

    if (alvo.length === 0) {
      console.log('Nada a remover — o banco já está limpo (ou a limpeza já rodou). Idempotente.')
      return
    }

    // Resumo por série (âncora).
    type LinhaAlvo = (typeof alvo)[number]
    const porSerie = new Map<string, { descricao: string; linhas: LinhaAlvo[] }>()
    for (const l of alvo) {
      const chave = String(l.transacao_pai_id)
      const atual = porSerie.get(chave)
      if (atual) atual.linhas.push(l)
      else porSerie.set(chave, { descricao: l.ancora_descricao ?? l.descricao, linhas: [l] })
    }

    for (const [paiId, serie] of porSerie) {
      console.log(`● Série "${serie.descricao}" (âncora ${paiId}) — ${serie.linhas.length} futura(s):`)
      for (const l of serie.linhas) {
        console.log(
          `    ${l.data}  ${l.tipo.padEnd(7)}  R$ ${Number(l.valor).toFixed(2).padStart(10)}  ${l.status}  (${l.descricao})`,
        )
      }
    }

    if (!aplicar) {
      console.log('\nDRY-RUN: nada foi removido. Rode com --apply para executar o DELETE.')
      return
    }

    // DELETE dentro de uma transação (rollback total se algo falhar).
    const removidas = await sql.begin(async (tx) => {
      const del = await tx`
        DELETE FROM transacoes t
        WHERE t.transacao_pai_id IS NOT NULL
          AND t.recorrencia <> 'avulsa'
          AND to_char(t.data, 'YYYY-MM') > ${competenciaAtual}
          AND t.status IN ('pendente', 'vencido')
        RETURNING t.id
      `
      return del.length
    })

    console.log(`\n✔ Removidas ${removidas} linha(s) recorrente(s) futura(s). A previsão bate pela projeção da série.`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
