CREATE TABLE "alertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"cliente_id" uuid,
	"cliente_nome" text NOT NULL,
	"titulo" text NOT NULL,
	"detalhe" text NOT NULL,
	"severidade" text NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"chave_dedup" text NOT NULL,
	"data_relevante" text NOT NULL,
	"detectado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvido_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relatorios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"cliente_nome" text NOT NULL,
	"tipo" text NOT NULL,
	"periodo_inicio" date NOT NULL,
	"periodo_fim" date NOT NULL,
	"conteudo" text NOT NULL,
	"gerado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alertas_chave_dedup_idx" ON "alertas" USING btree ("chave_dedup");--> statement-breakpoint
CREATE INDEX "alertas_status_idx" ON "alertas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "relatorios_cliente_gerado_idx" ON "relatorios" USING btree ("cliente_id","gerado_em");