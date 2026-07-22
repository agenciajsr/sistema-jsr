-- Migration 0043 — tabela google_ads_credentials (aditiva, idempotente).
-- Credenciais OAuth do Google Ads, SEPARADAS das da Agenda (google_credentials):
-- escopo adwords, conta que gerencia a MCC da agência, ciclo de vida próprio.
-- App single-tenant: no máximo UMA linha.
CREATE TABLE IF NOT EXISTS "google_ads_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text,
  "access_token" text,
  "refresh_token" text NOT NULL,
  "expiry" timestamp with time zone,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
