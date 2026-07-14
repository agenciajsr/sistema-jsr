CREATE TYPE "public"."tarefa_prioridade" AS ENUM('baixa', 'media', 'alta', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."tarefa_recorrencia" AS ENUM('nenhuma', 'diaria', 'semanal', 'mensal', 'anual', 'dia_sim_dia_nao', 'dias_uteis', 'personalizada');--> statement-breakpoint
CREATE TYPE "public"."tarefa_status" AS ENUM('a_fazer', 'em_andamento', 'concluida', 'nao_realizada');--> statement-breakpoint
CREATE TABLE "tarefa_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"concluido" boolean DEFAULT false NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"notas" text,
	"status" "tarefa_status" DEFAULT 'a_fazer' NOT NULL,
	"prioridade" "tarefa_prioridade" DEFAULT 'media' NOT NULL,
	"data" date NOT NULL,
	"cliente_id" uuid,
	"responsavel_id" uuid,
	"recorrencia" "tarefa_recorrencia" DEFAULT 'nenhuma' NOT NULL,
	"recorrencia_dias" jsonb,
	"eh_molde" boolean DEFAULT false NOT NULL,
	"tarefa_mae_id" uuid,
	"ativa" boolean DEFAULT true NOT NULL,
	"concluida_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefa_checklist_items" ADD CONSTRAINT "tarefa_checklist_items_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavel_id_profiles_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_tarefa_mae_id_tarefas_id_fk" FOREIGN KEY ("tarefa_mae_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefa_checklist_tarefa_id_idx" ON "tarefa_checklist_items" USING btree ("tarefa_id");--> statement-breakpoint
CREATE INDEX "tarefas_data_status_idx" ON "tarefas" USING btree ("data","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tarefas_mae_data_idx" ON "tarefas" USING btree ("tarefa_mae_id","data");