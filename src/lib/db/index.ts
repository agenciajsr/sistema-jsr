import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Conexão POOLED do Supabase (Supavisor, porta 6543, transaction mode).
//
// Config crítica para serverless (Vercel) — sem isto o app esgota o limite de
// conexões do pooler ("max client connections reached, limit: 200") porque cada
// instância abre seu próprio pool e as conexões ociosas nunca fechavam:
// - prepare: false  → transaction mode não suporta prepared statements.
// - max: 5          → poucas conexões por instância (o pooler multiplexa entre
//                     muitas instâncias; um pool grande por instância estoura o total).
//                     Era 3; subiu para 5 em 15/jul/2026 por causa da cascata do
//                     /financeiro: o withRetry não cancela as queries da 1ª
//                     tentativa (só selects, morrem em ≤12s pelo statement_timeout),
//                     e com max=3 elas ocupavam o pool inteiro — a 2ª tentativa e o
//                     getCurrentUser de TODAS as outras páginas na mesma instância
//                     Fluid Compute disputavam conexões e estouravam timeout.
//                     max=5 dá folga para a 2ª tentativa rodar mesmo com queries
//                     órfãs ocupando conexões. Seguro: Supavisor limita 200 clients
//                     e o app roda em pouquíssimas instâncias (região gru1).
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
// - max_pipeline: 1 → evita os travamentos intermitentes (financeiro e páginas
//                     pesadas). Por padrão (100), o postgres.js empilha várias
//                     queries na MESMA conexão ocupada ("pipelining"), mas o
//                     Supavisor em transaction mode NÃO suporta pipeline:
//                     entrega a 1ª query e as demais penduram PARA SEMPRE (nem
//                     o statement_timeout dispara, pois nunca chegam ao Postgres).
//                     Reproduzido e provado localmente em 14/jul/2026: 8 queries
//                     paralelas travavam 3+ min; sem pipeline completam em ~0,5s.
//                     Com 1, cada conexão executa 1 query por vez e o excedente
//                     espera na fila do pool — nunca pipelina.
//                     ATENÇÃO: NÃO usar 0 — com 0 o postgres.js quebra o
//                     sql.begin (erro UNSAFE_TRANSACTION) e TODA db.transaction
//                     falha (criar cliente, criar relatório...). Provado em
//                     15/jul/2026: begin falha com 0 e funciona com 1, mantendo
//                     o mesmo comportamento sem pipelining.
// `max_pipeline` existe no runtime do postgres.js (src/index.js) mas falta na
// declaração de tipos — a interseção preserva a checagem dos demais campos.
const opcoes: postgres.Options<Record<string, never>> & { max_pipeline: number } = {
  prepare: false,
  max: 5,
  max_pipeline: 1,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
  connection: {
    statement_timeout: 12_000,
  },
}
const client = postgres(process.env.DATABASE_URL!, opcoes)
export const db = drizzle({ client, schema })
