CREATE TABLE "tarefa_anexos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"storage_path" text NOT NULL,
	"upload_por_id" uuid,
	"upload_por_nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefa_atividades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"autor_id" uuid,
	"autor_nome" text NOT NULL,
	"tipo" text NOT NULL,
	"campo" text,
	"de" text,
	"para" text,
	"detalhe" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefa_comentarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"autor_id" uuid,
	"autor_nome" text NOT NULL,
	"texto" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefas" ADD COLUMN "fixada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefa_anexos" ADD CONSTRAINT "tarefa_anexos_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_anexos" ADD CONSTRAINT "tarefa_anexos_upload_por_id_profiles_id_fk" FOREIGN KEY ("upload_por_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_atividades" ADD CONSTRAINT "tarefa_atividades_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_atividades" ADD CONSTRAINT "tarefa_atividades_autor_id_profiles_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_comentarios" ADD CONSTRAINT "tarefa_comentarios_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_comentarios" ADD CONSTRAINT "tarefa_comentarios_autor_id_profiles_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefa_anexos_tarefa_id_idx" ON "tarefa_anexos" USING btree ("tarefa_id");--> statement-breakpoint
CREATE INDEX "tarefa_atividades_tarefa_created_idx" ON "tarefa_atividades" USING btree ("tarefa_id","created_at");--> statement-breakpoint
CREATE INDEX "tarefa_comentarios_tarefa_created_idx" ON "tarefa_comentarios" USING btree ("tarefa_id","created_at");