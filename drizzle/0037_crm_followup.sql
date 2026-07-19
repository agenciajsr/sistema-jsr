-- Migration 0037 (quick-260719-s3a): sistema de follow-up no CRM de vendas.
-- ADITIVA e segura: só adiciona colunas nullable — nenhum dado existente muda.
--   followup_nivel      = nível D1-D6 na visão Follow-up (null = fora do fluxo;
--                         nunca zerado ao sair da etapa — histórico).
--   ultimo_followup_em  = carimbo do último follow-up feito (base dos prazos
--                         crescentes de src/lib/crm/followup.ts).
--
-- SEED da etapa "Follow-up" no pipeline Vendas padrão (após 'Contato Feito'):
-- fica SÓ no script scripts/aplicar-migration-0037.ts, porque exige um
-- UPDATE (empurrar as ordens >= 2) + INSERT condicionais e ATÔMICOS — o script
-- roda tudo numa transação conferindo antes se a etapa já existe (idempotente).
--
-- Aplicar NA MÃO via: npx tsx --env-file=.env.local scripts/aplicar-migration-0037.ts
-- (NUNCA drizzle-kit migrate — ver decisão 260715-1rq; SQL gerado à mão porque
-- o drizzle-kit generate está quebrado por colisão de snapshots — 260717-qq6.)
ALTER TABLE "crm_oportunidades" ADD COLUMN IF NOT EXISTS "followup_nivel" integer;--> statement-breakpoint
ALTER TABLE "crm_oportunidades" ADD COLUMN IF NOT EXISTS "ultimo_followup_em" timestamp with time zone;
