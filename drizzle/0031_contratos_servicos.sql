-- 0031: serviços contratados ESTRUTURADOS no contrato (quick-260716-ky2).
-- 100% ADITIVA e retrocompatível: coluna jsonb NULLABLE. Contratos antigos
-- ficam com servicos = NULL e continuam usando o fallback servico (text) +
-- valor_mensal — nenhuma linha existente é tocada.
-- Formato do jsonb: [{"servico": "trafego_pago", "valor": 1500, "plataformas": ["meta_ads"]}]
-- (ver src/lib/contratos/servicos-contratados.ts).
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "servicos" jsonb;
