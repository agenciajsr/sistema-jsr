-- Migration 0041 — índice único parcial (transacao_pai_id, data) em transacoes.
-- Trava de corrida da materialização recorrente do financeiro (quick-260721-ogt):
-- garante 1 competência por série (transacao_pai_id) por data. Parcial: só vale
-- para os FILHOS (transacao_pai_id NOT NULL) — as âncoras têm pai NULL e ficam de fora.
-- Idempotente (IF NOT EXISTS).
--
-- ⚠️ ORDEM DE APLICAÇÃO (orquestrador): rodar a LIMPEZA das futuras pré-geradas
-- (scripts/limpar-recorrentes-futuras.ts --apply) ANTES desta migration — se
-- sobrar duplicata (transacao_pai_id, data) o índice único falha ao criar.
CREATE UNIQUE INDEX IF NOT EXISTS "ux_transacoes_pai_data"
  ON "transacoes" ("transacao_pai_id","data")
  WHERE "transacao_pai_id" IS NOT NULL;
