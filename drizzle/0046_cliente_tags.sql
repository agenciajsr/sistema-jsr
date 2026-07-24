-- Migration 0046 — coluna `tags` em clientes (aditiva, idempotente).
-- Tags livres do cliente (ex: "Estética", "Laser", "Alto potencial") — jsonb
-- array de strings, exibidas como badges no card Dados de cadastro da ficha
-- (mockup modelo_cliente_novo).
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "tags" jsonb;
