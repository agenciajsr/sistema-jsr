-- Central de automações da aba Ferramentas (liga/desliga + config editável).
CREATE TABLE IF NOT EXISTS "automacoes" (
  "chave" text PRIMARY KEY,
  "ativo" boolean NOT NULL DEFAULT false,
  "config" jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
