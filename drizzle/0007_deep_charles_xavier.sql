CREATE TYPE "public"."forma_pagamento" AS ENUM('pix', 'boleto', 'cartao', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."tipo_pessoa" AS ENUM('fisica', 'juridica');--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "tipo_pessoa" "tipo_pessoa" DEFAULT 'juridica';--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "documento" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "razao_social" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "nome_fantasia" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "endereco" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "cidade" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "estado" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "cep" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "site_url" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "forma_pagamento" "forma_pagamento";--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "dia_pagamento" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "servicos_contratados" jsonb;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "gestor_id" uuid;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "verba_mensal" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "ticket_medio" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "agendamento_posts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "frequencia_posts" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "origem_cliente" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "objetivo_principal" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_gestor_id_profiles_id_fk" FOREIGN KEY ("gestor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;