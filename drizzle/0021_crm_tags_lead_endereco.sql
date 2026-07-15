-- 0021: sistema de tags do CRM (crm_tags + crm_contato_tags) e colunas de
-- endereço completo em crm_contatos (modal "Criar novo Lead", imagens 07-11).
-- Escrita MANUALMENTE e aplicada via scripts/aplicar-migration-0021.ts
-- (NUNCA drizzle-kit migrate — controle vazio no banco faria replay da 0000).
CREATE TABLE IF NOT EXISTS "crm_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_contato_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contato_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "crm_contato_tags" ADD CONSTRAINT "crm_contato_tags_contato_id_crm_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."crm_contatos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "crm_contato_tags" ADD CONSTRAINT "crm_contato_tags_tag_id_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_tags_workspace_nome_idx" ON "crm_tags" USING btree ("workspace_id","nome");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_contato_tags_contato_tag_idx" ON "crm_contato_tags" USING btree ("contato_id","tag_id");
--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD COLUMN IF NOT EXISTS "pais" text;
--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD COLUMN IF NOT EXISTS "numero" text;
--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD COLUMN IF NOT EXISTS "complemento" text;
--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD COLUMN IF NOT EXISTS "bairro" text;
