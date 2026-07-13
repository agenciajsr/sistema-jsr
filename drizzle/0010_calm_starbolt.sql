-- NOTA: Esta migration já foi aplicada em produção manualmente (workflow controlado).
-- Reescrita de forma IDEMPOTENTE (IF NOT EXISTS / guards) para ser segura caso
-- seja reexecutada ou aplicada num banco novo/staging. Consolida o que antes estava
-- espalhado no órfão 0010_add_funding_source.sql (removido).
DO $$ BEGIN
 CREATE TYPE "public"."categoria_documento" AS ENUM('contrato', 'comprovante', 'briefing', 'criativo', 'relatorio', 'outro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"categoria" "categoria_documento" DEFAULT 'outro' NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"upload_por_id" uuid,
	"upload_por_nome" text NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "funding_source" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentos" ADD CONSTRAINT "documentos_upload_por_id_profiles_id_fk" FOREIGN KEY ("upload_por_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documentos_cliente_id_idx" ON "documentos" USING btree ("cliente_id");
