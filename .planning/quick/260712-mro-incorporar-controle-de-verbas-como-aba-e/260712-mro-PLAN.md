# Quick Task 260712-mro: Verbas como aba em /campanhas

**Created:** 2026-07-12
**Mode:** quick

## Task 1: Criar lógica de dados de verba (server-side)

**files:** `src/lib/trafego/verbas.ts` (novo)
**action:**
1. Criar função `getVerbasTodosClientes()` que retorna para cada cliente: nome, verbaMensal, gastoMes (soma spend de campaignInsights do mês atual), percentual, projeção30d, status (ok/atencao/critico)
2. Criar função `getVerbaCliente(clienteId)` que retorna detalhe de um cliente: mesmos campos + série diária de gasto

**verify:** Funções tipadas, queries corretas
**done:** Dados de verba disponíveis server-side

## Task 2: Criar componente de aba Verbas + painel de detalhe

**files:** `src/components/trafego/painel-verbas.tsx` (novo), `src/components/trafego/verba-detalhe.tsx` (novo)
**action:**
1. `PainelVerbas`: tabela com todos os clientes (nome, verba, gasto, %, projeção, status badge)
2. `VerbaDetalhe`: card com barra de progresso, projeção estimada, alerta visual de ritmo (>80% antes do dia 20 ou <50% depois do dia 20)

**verify:** Componentes renderizam com dados reais
**done:** Componentes prontos para uso

## Task 3: Integrar aba na página /campanhas e remover /verbas-ads

**files:** `src/app/(app)/campanhas/page.tsx`, `src/app/(app)/verbas-ads/` (remover)
**action:**
1. Adicionar sistema de abas (Tabs) na página de campanhas: "Performance" (conteúdo atual) | "Verbas" (novo)
2. Aba Verbas: se nenhum cliente selecionado → PainelVerbas (visão geral); se cliente selecionado → VerbaDetalhe
3. Remover diretório /verbas-ads completamente
4. Seletor de abas via searchParam `tab=verbas` para URL compartilhável

**verify:** Aba funciona, URL compartilhável, /verbas-ads removida
**done:** Verbas integradas em campanhas
