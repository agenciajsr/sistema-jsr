# Quick Task 260712-mro: Summary

**Completed:** 2026-07-12
**Commit:** b0cef77

## What was done

1. **Aba "Verbas" em /campanhas** — Sistema de abas (Performance | Verbas) com navegação via searchParam `tab=verbas`

2. **Visão geral (sem cliente selecionado)** — Tabela mostrando todos os clientes com verba configurada: verba mensal, gasto real, barra de progresso %, projeção e badge de status

3. **Detalhe por cliente** — Card com barra de progresso grande, projeção até fim do mês, comparação com verba, alerta visual de ritmo + gráfico diário de gasto

4. **Lógica de cálculo** (`src/lib/trafego/verbas.ts`):
   - Gasto real: soma de `campaignInsights.spend` do mês atual para as contas do cliente
   - Projeção: média diária × total de dias do mês
   - Status: ok/atenção/crítico baseado em ritmo (>90% = crítico, >80% antes de 2/3 do mês = atenção, <40% na segunda metade = atenção)

5. **Remoção de /verbas-ads** — Placeholder 100% mock eliminado

## Files changed

- `src/lib/trafego/verbas.ts` — Novo: getVerbasTodosClientes(), getVerbaCliente()
- `src/components/trafego/abas-campanhas.tsx` — Novo: seletor de aba client-side
- `src/components/trafego/painel-verbas.tsx` — Novo: tabela visão geral
- `src/components/trafego/verba-detalhe.tsx` — Novo: card detalhe com projeção
- `src/app/(app)/campanhas/page.tsx` — Integração das abas + dados de verba
- `src/app/(app)/verbas-ads/page.tsx` — Removido
