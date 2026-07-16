-- Fase 4 Parte 2 (funil) — assinatura eletrônica do contrato via Autentique.
-- 100% ADITIVA: só ADD COLUMN IF NOT EXISTS (tudo nullable). Escrita À MÃO
-- (o snapshot do drizzle segue contaminado — mesmo caso da 0029).
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "tipo_documento" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "autentique_documento_id" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "enviado_para_assinatura_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "assinado_em" timestamp with time zone;
