import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Conexão POOLED do Supabase (Supavisor, porta 6543, transaction mode).
//
// Config crítica para serverless (Vercel) — sem isto o app esgota o limite de
// conexões do pooler ("max client connections reached, limit: 200") porque cada
// instância abre seu próprio pool e as conexões ociosas nunca fechavam:
// - prepare: false  → transaction mode não suporta prepared statements.
// - max: 3          → poucas conexões por instância (o pooler multiplexa entre
//                     muitas instâncias; um pool grande por instância estoura o total).
// - idle_timeout    → fecha conexões ociosas após 20s, devolvendo-as ao pooler
//                     em vez de acumular (principal causa do esgotamento).
// - max_lifetime    → recicla conexões periodicamente (evita conexões zumbis).
// - connect_timeout → falha rápido (10s) se o DB/pooler não responder (cold
//                     start / DB acordando) em vez de travar até o default e
//                     estourar o timeout serverless (504).
// - statement_timeout → aborta qualquer query que passe de 12s (parametro de
//                     conexão do Postgres, em ms). Fail-fast: durante um soluço
//                     do Supabase, uma query lenta erra rapido em vez de deixar
//                     a função serverless pendurada ate os 300s da Vercel.
// - max_pipeline: 0 → CAUSA RAIZ dos travamentos intermitentes (financeiro e
//                     páginas pesadas). Por padrão (100), o postgres.js empilha
//                     várias queries na MESMA conexão ocupada ("pipelining"),
//                     mas o Supavisor em transaction mode NÃO suporta pipeline:
//                     entrega a 1ª query e as demais penduram PARA SEMPRE (nem
//                     o statement_timeout dispara, pois nunca chegam ao Postgres).
//                     Reproduzido e provado localmente em 14/jul/2026: 8 queries
//                     paralelas travavam 3+ min; com 0, completam em ~0,5s.
//                     Com 0, cada conexão executa 1 query por vez e o excedente
//                     espera na fila do pool — nunca pipelina.
// `max_pipeline` existe no runtime do postgres.js (src/index.js) mas falta na
// declaração de tipos — a interseção preserva a checagem dos demais campos.
const opcoes: postgres.Options<Record<string, never>> & { max_pipeline: number } = {
  prepare: false,
  max: 3,
  max_pipeline: 0,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
  connection: {
    statement_timeout: 12_000,
  },
}
const client = postgres(process.env.DATABASE_URL!, opcoes)
export const db = drizzle({ client, schema })
