-- Migration 0040 — coluna `interno` em clientes (aditiva, idempotente).
-- Marca o "perfil mãe" (a própria agência): a conta de anúncio da agência é
-- vinculada a um cliente interno=true, que aparece no Tráfego/Campanhas mas fica
-- FORA das métricas de negócio (contagem de clientes, MRR, CAC, LTV/churn, lista).
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "interno" boolean NOT NULL DEFAULT false;
