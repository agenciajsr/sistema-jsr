---
phase: quick-260711-sv1
plan: 01
subsystem: trafego
tags: [meta-ads, campanhas, agregacao, dashboard]
requires:
  - ad_accounts / campaign_insights (sync Meta ja existente)
  - actions (jsonb) salvo pelo sync
provides:
  - parseActions + agregacao por cliente (getResumoCliente, listarClientesComContas)
  - vinculo conta->cliente (vincularContaAoCliente)
  - tela /campanhas premium por cliente
affects:
  - src/app/(app)/campanhas/page.tsx
  - src/actions/trafego.ts
tech-stack:
  added: []
  patterns:
    - server component com searchParams (?cliente&periodo) + selects client que navegam
    - dedup de actions da Meta por prioridade (evita dupla contagem)
    - client boundary isolado para grafico Recharts
key-files:
  created:
    - src/lib/trafego/aggregate.ts
    - src/lib/trafego/aggregate.test.ts
    - src/components/trafego/contas-nao-vinculadas.tsx
    - src/components/trafego/seletor-campanhas.tsx
    - src/components/trafego/grafico-verba.tsx
  modified:
    - src/lib/meta/client.ts
    - src/lib/meta/schemas.ts
    - src/actions/trafego.ts
    - src/app/(app)/campanhas/page.tsx
decisions:
  - Chart Recharts extraido para componente client dedicado (GraficoVerba) porque a page e server component
  - parseActions usa first-match por prioridade em todos os grupos (nao soma variantes) para evitar dupla contagem
metrics:
  duration: ~10min
  completed: 2026-07-12
---

# Phase quick-260711-sv1 Plan 01: Repaginar /campanhas (Parte 1) Summary

Dashboard de tráfego repaginado de "por conta / só gasto" para **premium por cliente**: verba, métrica-herói do nicho (Vendas/Conversas/Leads), CPA/CPL, gráfico de verba/dia e ranking de campanhas — tudo com dados reais parseados do campo `actions` da Meta, mais o elo que faltava (vínculo conta→cliente) e sync ampliado para histórico diário de 30 dias.

## O que foi entregue

1. **Sync com histórico diário (Task 1)** — `fetchCampaignInsights` passou de `date_preset: 'yesterday'` para `date_preset: 'last_30d'` + `time_increment: '1'`, fazendo a Meta retornar uma linha por dia por campanha. O upsert `(adAccountId, date, campaignId)` do sync já lida com isso sem alteração no schema nem no sync.
2. **Camada de agregação testada (Task 2)** — `src/lib/trafego/aggregate.ts`: `parseActions` extrai leads/vendas/conversas/linkClicks do jsonb com **dedup por prioridade** (nunca soma variantes redundantes de compra/conversa na mesma linha); `metricaHeroi(nicho)`, `listarClientesComContas()` e `getResumoCliente(clienteId, 7|30)` (agrega todas as contas do cliente: totais, derivadas CPM/CTR/CPL/CPA, série de verba/dia e ranking top-10). Estados vazios retornam resumo zerado, nunca lançam.
3. **Vínculo conta→cliente (Task 3)** — `vincularContaAoCliente` (UPDATE protegido por sessão + `revalidatePath('/campanhas')`), `getContasNaoVinculadas`, `listarClientes`, e o componente `ContasNaoVinculadas` (Select por conta; some quando não há contas soltas).
4. **Tela premium (Task 4)** — `/campanhas` reescrita como server component com `?cliente&periodo`; `SeletorCampanhas` navega por searchParams; KPIs com StatCard (métrica-herói destacada por nicho), `GraficoVerba` (AreaChart) e ranking de campanhas; estados vazios claros para "nada sincronizado", "selecione um cliente" e "sem dados no período".

## Métrica-herói por nicho

- `ecommerce` → **Vendas** (KPI de custo = CPA)
- `negocio_local` → **Conversas** (custo por resultado)
- `infoproduto` → **Leads** (custo por lead)

## Deviations from Plan

### Auto-fixed / additions

**1. [Rule 3 - Blocking] Componente client dedicado para o gráfico Recharts**
- **Found during:** Task 4
- **Issue:** A page é server component (async + searchParams), mas Recharts/ChartContainer exigem `'use client'`.
- **Fix:** Extraído `src/components/trafego/grafico-verba.tsx` como client component recebendo `serieSpendPorDia` por props. KPIs e Table continuam server-rendered.
- **Commit:** 78f7711

Fora isso, o plano foi executado como escrito.

## Restrições respeitadas

- `src/lib/db/schema.ts` **não** alterado; **nenhuma** migration gerada/rodada.
- Sem novas dependências.
- SyncButton e disparo de sync preservados intactos.
- Toda a UI em português.

## Verificação

- `npx tsc --noEmit`: limpo.
- `npx vitest run src/lib/trafego/aggregate.test.ts`: 6/6 verde (mapeamento + dedup de compras/conversas + null-safety).
- `npm run build`: conclui com sucesso.
- `npm run lint`: sem erros NOVOS — os restantes são pré-existentes e fora de escopo (ui/sidebar.tsx, hooks/use-mobile.ts, `any` de sync-meta-ads.ts, e warnings pré-existentes em alertas/page.tsx e financeiro/transacao-form.tsx, arquivos não tocados).

## Known Stubs

Nenhum. Todos os dados vêm do banco (agregação real de `campaign_insights.actions`). Sem dados, a tela mostra estados vazios em vez de mock.

## Commits

- 9f105cc: feat(quick-260711-sv1): ampliar sync Meta para historico diario de 30 dias
- 707f024: feat(quick-260711-sv1): camada de agregacao por cliente + parseActions
- 92a2d80: feat(quick-260711-sv1): vinculo conta->cliente (action + UI)
- 78f7711: feat(quick-260711-sv1): tela /campanhas premium por cliente

## Self-Check: PASSED

Todos os arquivos criados existem e os 4 commits de tarefa estão presentes.
