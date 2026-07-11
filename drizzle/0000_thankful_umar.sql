CREATE TYPE "public"."categoria_transacao" AS ENUM('mensalidade', 'projeto', 'outro', 'ferramenta', 'ads_agencia', 'salario');--> statement-breakpoint
CREATE TYPE "public"."cliente_status" AS ENUM('ativo', 'pausado', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."nicho" AS ENUM('ecommerce', 'negocio_local', 'infoproduto');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'membro');--> statement-breakpoint
CREATE TYPE "public"."status_transacao" AS ENUM('pago', 'pendente', 'vencido');--> statement-breakpoint
CREATE TYPE "public"."tipo_transacao" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nicho" "nicho" NOT NULL,
	"status" "cliente_status" DEFAULT 'ativo' NOT NULL,
	"contato_nome" text,
	"contato_telefone" text,
	"contato_email" text,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"data_inicio" date NOT NULL,
	"data_vencimento" date NOT NULL,
	"valor_mensal" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"role" "role" DEFAULT 'membro' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_transacao" NOT NULL,
	"categoria" "categoria_transacao" NOT NULL,
	"cliente_id" uuid,
	"descricao" text NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"data" date NOT NULL,
	"status" "status_transacao" DEFAULT 'pendente' NOT NULL,
	"dia_vencto" integer,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contratos_cliente_id_idx" ON "contratos" USING btree ("cliente_id","data_inicio");--> statement-breakpoint
CREATE INDEX "transacoes_data_idx" ON "transacoes" USING btree ("data","tipo");