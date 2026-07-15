CREATE TABLE "relatorio_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"frequencia" text NOT NULL,
	"dia_semana" integer,
	"dia_mes" integer,
	"periodo_dias" integer,
	"horario_envio" text,
	"destino_tipo" text,
	"destino_valor" text,
	"cabecalho" text NOT NULL,
	"incluir_compilado" boolean DEFAULT true NOT NULL,
	"mensagem_compilado" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relatorio_blocos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"ad_account_id" uuid NOT NULL,
	"nivel" text NOT NULL,
	"campanhas_selecionadas" jsonb,
	"metricas" jsonb NOT NULL,
	"mensagem" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relatorios" ADD COLUMN "config_id" uuid;--> statement-breakpoint
ALTER TABLE "relatorio_configs" ADD CONSTRAINT "relatorio_configs_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorio_blocos" ADD CONSTRAINT "relatorio_blocos_config_id_relatorio_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."relatorio_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorio_blocos" ADD CONSTRAINT "relatorio_blocos_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_config_id_relatorio_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."relatorio_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "relatorio_blocos_config_idx" ON "relatorio_blocos" USING btree ("config_id","ordem");--> statement-breakpoint
CREATE INDEX "relatorio_configs_cliente_idx" ON "relatorio_configs" USING btree ("cliente_id");