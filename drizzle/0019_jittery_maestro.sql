CREATE TABLE "crm_atividades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"oportunidade_id" uuid,
	"contato_id" uuid,
	"empresa_id" uuid,
	"tipo" text NOT NULL,
	"autor_id" uuid,
	"autor_nome" text NOT NULL,
	"campo" text,
	"de" text,
	"para" text,
	"detalhe" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"empresa_id" uuid,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"telefone_normalizado" text,
	"cargo" text,
	"origem" text DEFAULT 'manual' NOT NULL,
	"origem_detalhe" jsonb,
	"dono_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"segmento" text,
	"site" text,
	"instagram" text,
	"telefone" text,
	"cidade" text,
	"estado" text,
	"notas" text,
	"dono_id" uuid,
	"cliente_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"cor" text,
	"probabilidade" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"fonte" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"erro_detalhe" text,
	"contato_id" uuid,
	"oportunidade_id" uuid,
	"dedup_hash" text NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_oportunidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"etapa_id" uuid NOT NULL,
	"empresa_id" uuid,
	"contato_id" uuid,
	"titulo" text NOT NULL,
	"valor" numeric(12, 2),
	"tipo_receita" text DEFAULT 'mensalidade',
	"status" text DEFAULT 'aberta' NOT NULL,
	"motivo_perda" text,
	"ganha_em" timestamp with time zone,
	"perdida_em" timestamp with time zone,
	"dono_id" uuid,
	"origem" text,
	"servicos_interesse" jsonb,
	"data_prevista_fechamento" date,
	"ordem_na_etapa" integer DEFAULT 0 NOT NULL,
	"cliente_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"padrao" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"oportunidade_id" uuid,
	"contato_id" uuid,
	"tipo" text DEFAULT 'followup' NOT NULL,
	"titulo" text NOT NULL,
	"notas" text,
	"data_vencimento" timestamp with time zone NOT NULL,
	"concluida" boolean DEFAULT false NOT NULL,
	"concluida_em" timestamp with time zone,
	"dono_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_membros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"papel" text DEFAULT 'vendedor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_oportunidade_id_crm_oportunidades_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."crm_oportunidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_contato_id_crm_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."crm_contatos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_empresa_id_crm_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."crm_empresas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD CONSTRAINT "crm_contatos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD CONSTRAINT "crm_contatos_empresa_id_crm_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."crm_empresas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contatos" ADD CONSTRAINT "crm_contatos_dono_id_profiles_id_fk" FOREIGN KEY ("dono_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_empresas" ADD CONSTRAINT "crm_empresas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_empresas" ADD CONSTRAINT "crm_empresas_dono_id_profiles_id_fk" FOREIGN KEY ("dono_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_empresas" ADD CONSTRAINT "crm_empresas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_etapas" ADD CONSTRAINT "crm_etapas_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_inbox" ADD CONSTRAINT "crm_lead_inbox_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_inbox" ADD CONSTRAINT "crm_lead_inbox_contato_id_crm_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."crm_contatos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_inbox" ADD CONSTRAINT "crm_lead_inbox_oportunidade_id_crm_oportunidades_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."crm_oportunidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_etapa_id_crm_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."crm_etapas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_empresa_id_crm_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."crm_empresas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_contato_id_crm_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."crm_contatos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_dono_id_profiles_id_fk" FOREIGN KEY ("dono_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD CONSTRAINT "crm_tarefas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD CONSTRAINT "crm_tarefas_oportunidade_id_crm_oportunidades_id_fk" FOREIGN KEY ("oportunidade_id") REFERENCES "public"."crm_oportunidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD CONSTRAINT "crm_tarefas_contato_id_crm_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."crm_contatos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tarefas" ADD CONSTRAINT "crm_tarefas_dono_id_profiles_id_fk" FOREIGN KEY ("dono_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membros" ADD CONSTRAINT "workspace_membros_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membros" ADD CONSTRAINT "workspace_membros_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_atividades_oportunidade_created_idx" ON "crm_atividades" USING btree ("oportunidade_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_contatos_workspace_email_idx" ON "crm_contatos" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "crm_contatos_workspace_telefone_idx" ON "crm_contatos" USING btree ("workspace_id","telefone_normalizado");--> statement-breakpoint
CREATE INDEX "crm_empresas_workspace_nome_idx" ON "crm_empresas" USING btree ("workspace_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_lead_inbox_dedup_hash_idx" ON "crm_lead_inbox" USING btree ("dedup_hash");--> statement-breakpoint
CREATE INDEX "crm_oportunidades_pipeline_etapa_status_idx" ON "crm_oportunidades" USING btree ("pipeline_id","etapa_id","status");--> statement-breakpoint
CREATE INDEX "crm_oportunidades_workspace_status_idx" ON "crm_oportunidades" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "crm_tarefas_oportunidade_concluida_idx" ON "crm_tarefas" USING btree ("oportunidade_id","concluida");--> statement-breakpoint
CREATE INDEX "crm_tarefas_dono_vencto_idx" ON "crm_tarefas" USING btree ("dono_id","data_vencimento");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_membros_workspace_profile_idx" ON "workspace_membros" USING btree ("workspace_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");--> statement-breakpoint
-- Seed idempotente do CRM (v1 single-tenant): workspace JSR + membros a partir
-- de profiles + pipeline Vendas (padrao) + 6 etapas. Roda junto do deploy —
-- cada bloco e guardado por NOT EXISTS / ON CONFLICT, entao re-rodar e seguro.
INSERT INTO "workspaces" ("nome","slug") SELECT 'JSR','jsr' WHERE NOT EXISTS (SELECT 1 FROM "workspaces" WHERE "slug"='jsr');--> statement-breakpoint
INSERT INTO "workspace_membros" ("workspace_id","profile_id","papel") SELECT w.id, p.id, CASE WHEN p.role='admin' THEN 'admin' ELSE 'vendedor' END FROM "profiles" p CROSS JOIN "workspaces" w WHERE w.slug='jsr' ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "crm_pipelines" ("workspace_id","nome","ordem","padrao") SELECT w.id, 'Vendas', 0, true FROM "workspaces" w WHERE w.slug='jsr' AND NOT EXISTS (SELECT 1 FROM "crm_pipelines" cp WHERE cp."workspace_id" = w.id AND cp."nome" = 'Vendas');--> statement-breakpoint
INSERT INTO "crm_etapas" ("pipeline_id","nome","ordem","probabilidade")
SELECT p.id, e.nome, e.ordem, e.probabilidade
FROM "crm_pipelines" p
JOIN "workspaces" w ON w.id = p."workspace_id" AND w."slug" = 'jsr'
CROSS JOIN (VALUES
  ('Novo Lead', 0, 10),
  ('Contato Feito', 1, 20),
  ('Qualificado', 2, 40),
  ('Reunião Agendada', 3, 60),
  ('Proposta Enviada', 4, 75),
  ('Negociação', 5, 90)
) AS e(nome, ordem, probabilidade)
WHERE p."nome" = 'Vendas' AND p."padrao" = true
  AND NOT EXISTS (SELECT 1 FROM "crm_etapas" ce WHERE ce."pipeline_id" = p.id);