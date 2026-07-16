-- Produtos/servicos DENTRO do negocio (card do kanban): [{servico, valor}].
-- Corrige o modelo da secao "Produtos e Valores" da ficha do lead: antes cada
-- produto virava um negocio novo (card duplicado no kanban) e excluir o unico
-- produto fazia o lead sumir do quadro.
ALTER TABLE "crm_oportunidades" ADD COLUMN IF NOT EXISTS "produtos" jsonb;
