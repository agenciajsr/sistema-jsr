-- Migration 0010: Adicionar coluna funding_source em ad_accounts
-- NAO aplicada automaticamente — executar manualmente no Supabase Dashboard

ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS funding_source text;

COMMENT ON COLUMN ad_accounts.funding_source IS 'Fonte de pagamento da conta (credit_card, prepaid, invoice, etc.) — preenchido pelo sync Meta';
