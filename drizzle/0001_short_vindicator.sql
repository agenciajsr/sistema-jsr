CREATE TYPE "public"."frequencia_checklist" AS ENUM('diaria', 'semanal', 'mensal');--> statement-breakpoint
CREATE TABLE "acompanhamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"autor_id" uuid,
	"autor_nome" text NOT NULL,
	"nota" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tarefa" text NOT NULL,
	"frequencia" "frequencia_checklist" NOT NULL,
	"concluido" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "usa_asaas" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acompanhamentos_cliente_created_idx" ON "acompanhamentos" USING btree ("cliente_id","created_at");--> statement-breakpoint
CREATE INDEX "checklist_items_cliente_id_idx" ON "checklist_items" USING btree ("cliente_id");
