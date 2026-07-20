-- Migration 0039 — tabela investimentos_aquisicao (quick-260720-pev).
-- Lançamento mensal do investimento em aquisição por canal; alimenta o CAC por
-- canal e a relação LTV/CAC da Visão Executiva do Financeiro.
--
-- ATENÇÃO: aplicar NA MÃO (NUNCA `drizzle-kit migrate` — a tabela
-- drizzle.__drizzle_migrations do banco está vazia, o comando faria replay
-- desde a 0000 sobre os dados reais). DDL idempotente (IF NOT EXISTS).
-- Rodar: npx tsx --env-file=.env.local scripts/aplicar-migration-0039.ts
CREATE TABLE IF NOT EXISTS "investimentos_aquisicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canal" text NOT NULL,
	"competencia" text NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_invest_canal_competencia" ON "investimentos_aquisicao" ("canal","competencia");
