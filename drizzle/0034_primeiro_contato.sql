-- Migration 0034 (quick-260717-qq6): carimbo do 1º contato comercial do lead.
-- ADITIVA e segura: só adiciona uma coluna nullable — nenhum dado existente muda.
-- Preenchida pelas actions do CRM quando a 1ª tarefa/atividade de contato
-- (ligação/whatsapp/e-mail/reunião) é concluída ou registrada (só se null).
-- Alimenta o SLA de 24h (src/lib/crm/sla-contato.ts): indicador no card do
-- kanban + alerta persistido 'sla_primeiro_contato'.
--
-- Aplicar NA MÃO via: npx tsx --env-file=.env.local scripts/aplicar-migration-0034.ts
-- (NUNCA drizzle-kit migrate — ver decisão 260715-1rq.)
ALTER TABLE "crm_oportunidades" ADD COLUMN "primeiro_contato_em" timestamp with time zone;
