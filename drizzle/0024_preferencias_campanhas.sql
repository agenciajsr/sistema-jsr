-- Migration 0024: preferências do painel /campanhas por CLIENTE (jsonb).
-- Gerada À MÃO e IDEMPOTENTE (IF NOT EXISTS) — aplicar SOMENTE via
-- scripts/aplicar-migration-0024.ts (NUNCA drizzle-kit migrate).
CREATE TABLE IF NOT EXISTS "preferencias_campanhas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cliente_id" uuid NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
  "kpis" jsonb,
  "funil" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "preferencias_campanhas_cliente_id_idx" ON "preferencias_campanhas" ("cliente_id");
