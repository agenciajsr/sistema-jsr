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
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
  connection: {
    statement_timeout: 12_000,
  },
})
export const db = drizzle({ client, schema })
