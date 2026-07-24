-- Migration 0045 — perfil do NEGÓCIO do cliente + pastas + foto do usuário.
-- Aditiva e idempotente.
--   clientes.segmento          → ramo específico do cliente (ex: "Clínica de Estética")
--   clientes.principal_servico → o que o CLIENTE vende (ex: "Emagrecimento"),
--                                NÃO o serviço da agência (esse fica em servicos_contratados)
--   clientes.pastas            → jsonb [{nome, url}] de pastas do Drive nomeadas
--   profiles.foto_url          → URL pública da foto do usuário (bucket crm-fotos)
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "segmento" text;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "principal_servico" text;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "pastas" jsonb;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "foto_url" text;
