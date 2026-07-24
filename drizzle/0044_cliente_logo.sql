-- Migration 0044 — coluna `logo_url` em clientes (aditiva, idempotente).
-- URL PÚBLICA da logo do cliente (bucket crm-fotos, path clientes/{id}.{ext},
-- upsert). Exibida no avatar do header da ficha do cliente
-- (mockup modelo_cliente_novo). Mesmo padrão da foto do lead (foto_url).
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "logo_url" text;
