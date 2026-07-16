-- Fase 4 Parte 1 (funil) — fluxo de coleta de dados do contrato.
-- 100% ADITIVA: só ADD COLUMN (tudo nullable) + unique do token.
-- A migration gerada veio contaminada pelo snapshot defasado (automacoes,
-- crm_contatos.cliente_id, crm_oportunidades.produtos — já criadas nas
-- 0026/0027/0028); editada à mão para conter APENAS o delta real.
ALTER TABLE "contratos" ADD COLUMN "token" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "status_fluxo" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "duracao_meses" integer;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "servico" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "dados_contratante" jsonb;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "dados_recebidos_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_token_unique" UNIQUE("token");
