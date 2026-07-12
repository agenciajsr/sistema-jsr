---
phase: quick-260712-g1c
plan: 01
subsystem: financeiro
tags: [financeiro, previsao-caixa, recorrencia, centro-custo]
dependency_graph:
  requires: [transacoes, contratos, profiles, clientes]
  provides: [previsao-caixa, contas-receber-pagar, parcelas-recorrentes, centro-custo]
  affects: [financeiro, dashboard]
tech_stack:
  added: []
  patterns: [tabs-layout, server-actions-com-join-profiles, geracao-parcelas-date-fns]
key_files:
  created:
    - src/app/(app)/financeiro/contas-table.tsx
    - src/app/(app)/financeiro/previsao-caixa.tsx
    - drizzle/0009_nosy_rick_jones.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/validations/transacao.ts
    - src/actions/financeiro.ts
    - src/app/(app)/financeiro/page.tsx
    - src/app/(app)/financeiro/transacao-form.tsx
    - src/app/(app)/financeiro/transacoes-table.tsx
decisions:
  - "formaPagamento em transacoes usa coluna DB 'forma_pagamento_transacao' para evitar colisao com clientes.forma_pagamento"
  - "Self-reference transacaoPaiId usa (): any cast para evitar erro de referencia circular no Drizzle"
  - "Upload de comprovante simplificado como campo URL text (Supabase Storage sera integrado depois)"
  - "getResumoFinanceiro expandido com aReceber/aPagar para alimentar KPIs extras"
metrics:
  completed: "2026-07-12"
  tasks: 3
  files: 9
---

# Quick 260712-g1c: Reformular Modulo Financeiro Completo

Modulo financeiro estrategico com centro de custo, recorrencia automatica (parcelas), previsao de caixa 30 dias, 4 abas (Visao Geral / A Receber / A Pagar / Previsao), 6 KPIs.

## O que foi feito

### Task 1: Backend -- Schema, validacao e server actions
- **Schema**: 2 novos enums (`centroCustoEnum`, `recorrenciaEnum`) e 6 novos campos em `transacoes` (centroCusto, recorrencia, transacaoPaiId, formaPagamento, responsavelId, comprovanteUrl)
- **Validacao**: `transacaoSchema` expandido com centroCusto, recorrencia, formaPagamento, responsavelId (todos opcionais)
- **Actions novas**: `gerarParcelasRecorrentes` (gera parcelas ate contrato ou 12 meses), `getPrevisaoCaixa` (saldo projetado 30 dias), `getContasAReceber`, `getContasAPagar`, `uploadComprovante`
- **Actions atualizadas**: `createTransacao` agora inclui novos campos e gera parcelas automaticamente; `listTransacoes` com join profiles; `getResumoFinanceiro` com aReceber/aPagar
- **Commit**: 814b064

### Task 2: UI -- Pagina com 4 abas
- **page.tsx**: 6 KPIs no topo (Receita Paga, Despesas Pagas, Lucro, MRR, A Receber, A Pagar) + 4 abas via Tabs
- **transacao-form.tsx**: 5 novos campos (centro de custo, recorrencia, forma de pagamento, responsavel, URL comprovante)
- **transacoes-table.tsx**: colunas extras (centro de custo, forma pgto, responsavel, comprovante com icone)
- **contas-table.tsx** (novo): tabela reutilizavel para A Receber/A Pagar com total, acao marcar pago, highlight vencidos
- **previsao-caixa.tsx** (novo): saldo projetado 30 dias com grid 3 cards + lista de transacoes projetadas
- **Commit**: b850e61

### Task 3: Migration
- Migration `0009_nosy_rick_jones.sql` gerada com CREATE TYPE centro_custo/recorrencia + 6 ALTER TABLE ADD COLUMN + 2 FKs
- Migration NAO aplicada -- pronta para aplicar manualmente
- **Commit**: 0a93766

## Desvios do Plano

Nenhum desvio significativo. Ajustes menores:
- Coluna DB `forma_pagamento_transacao` (em vez de `forma_pagamento`) para evitar colisao com `clientes.forma_pagamento` que usa o mesmo enum
- Campo comprovante simplificado como text URL em vez de input file com upload (Supabase Storage e uma integracao separada)
- getResumoFinanceiro expandido com aReceber/aPagar (nao previsto no plano, mas necessario para alimentar os 6 KPIs)

## Stubs Conhecidos

- Campo "URL do Comprovante" no formulario nao esta conectado ao react-hook-form (input independente, nao salva). Upload real via Supabase Storage sera integrado em tarefa futura.

## Self-Check: PASSED

- contas-table.tsx: FOUND
- previsao-caixa.tsx: FOUND
- migration 0009: FOUND
- Commit 814b064: FOUND
- Commit b850e61: FOUND
- Commit 0a93766: FOUND
