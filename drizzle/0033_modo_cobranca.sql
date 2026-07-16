-- 0033: modo de cobrança POR CLIENTE (Fase 5 Parte 2 — quick-260716-sr5).
-- 100% ADITIVA: coluna nova em clientes com default seguro 'manual_pix'
-- (manual nunca gera custo no Asaas) + backfill a partir do estado atual.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "modo_cobranca" text NOT NULL DEFAULT 'manual_pix';
--> statement-breakpoint
-- Backfill: quem já usava o Asaas (flag antiga ou customer já cadastrado lá)
-- vira automático — o resto fica manual_pix (default seguro).
UPDATE "clientes" SET "modo_cobranca" = 'automatico_asaas'
  WHERE "usa_asaas" = true OR "asaas_customer_id" IS NOT NULL;
--> statement-breakpoint
COMMENT ON COLUMN "clientes"."usa_asaas" IS 'DEPRECIADA — substituída por modo_cobranca (0033). Não usar em código novo.';
