CREATE TYPE "public"."centro_custo" AS ENUM('operacao', 'midia', 'infraestrutura');--> statement-breakpoint
CREATE TYPE "public"."recorrencia" AS ENUM('mensal', 'trimestral', 'avulsa');--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "centro_custo" "centro_custo";--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "recorrencia" "recorrencia" DEFAULT 'avulsa' NOT NULL;--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "transacao_pai_id" uuid;--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "forma_pagamento_transacao" "forma_pagamento";--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "responsavel_id" uuid;--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "comprovante_url" text;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_transacao_pai_id_transacoes_id_fk" FOREIGN KEY ("transacao_pai_id") REFERENCES "public"."transacoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_responsavel_id_profiles_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;