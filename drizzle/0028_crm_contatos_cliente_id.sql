-- Conversão Ganho → Cliente (Fase 3 do funil): idempotência por lead.
-- Aditiva: só adiciona coluna + FK em crm_contatos. Aplicar NA MÃO (padrão do
-- projeto — nunca drizzle-kit migrate/push).
-- Obs.: o drizzle-kit generate também emitiu "CREATE TABLE automacoes" e
-- "ADD COLUMN produtos" porque o snapshot estava atrás das migrations manuais
-- 0026/0027 — esses objetos JÁ EXISTEM em produção e foram removidos daqui.
ALTER TABLE "crm_contatos" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD CONSTRAINT "crm_contatos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;
