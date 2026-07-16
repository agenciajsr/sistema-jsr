-- 0032: cobrança via Asaas (Fase 5 Parte 1 — quick-260716-qzu).
-- 100% ADITIVA: coluna nova nullable em clientes + tabela nova cobrancas.
-- Nenhuma linha existente é tocada. Tabela NOVA de propósito (não reusa
-- transacoes): transacoes é o livro-caixa do financeiro; cobrancas tem ciclo
-- Asaas próprio (invoiceUrl, webhook de status, quitação manual).
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "asaas_customer_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cobrancas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cliente_id" uuid NOT NULL REFERENCES "clientes"("id") ON DELETE cascade,
  "contrato_id" uuid REFERENCES "contratos"("id") ON DELETE set null,
  "competencia" text NOT NULL,
  "valor" numeric(10,2) NOT NULL,
  "status" text NOT NULL DEFAULT 'pendente',
  "vencimento" date NOT NULL,
  "asaas_payment_id" text UNIQUE,
  "invoice_url" text,
  "forma_quitacao" text,
  "pago_em" timestamptz,
  "criado_via" text NOT NULL DEFAULT 'automatico',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Índice único PARCIAL: impede duplicar a competência no fluxo AUTOMÁTICO
-- sem travar cobranças manuais extras no mesmo mês.
CREATE UNIQUE INDEX IF NOT EXISTS "cobrancas_contrato_competencia_uniq"
  ON "cobrancas" ("contrato_id", "competencia")
  WHERE "criado_via" = 'automatico';
