-- Migration 0042 — coluna forma_pagamento_manual em ad_accounts (aditiva, idempotente).
-- O Meta bloqueia funding_source_details (Permission Denied #10) e funding_source vem
-- vazio, então a forma de pagamento é registrada MANUALMENTE na tela de Verbas.
-- Valores: 'cartao_credito' | 'pix_deposito' | 'boleto' | 'faturamento' | null.
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "forma_pagamento_manual" text;
