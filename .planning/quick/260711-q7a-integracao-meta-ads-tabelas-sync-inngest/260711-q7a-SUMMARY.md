---
phase: quick-260711-q7a
plan: 01
subsystem: integracao-meta-ads
tags: [meta-ads, inngest, sync, trafego, graph-api]
dependency_graph:
  requires: [schema-clientes, auth-session]
  provides: [ad-accounts-table, campaign-insights-table, meta-api-client, inngest-sync, trafego-page-real]
  affects: [trafego-page, dashboard]
tech_stack:
  added: [inngest@4.12.1]
  patterns: [graph-api-fetch-direto, zod-validation-boundary, inngest-cron-plus-event, step-run-per-account]
key_files:
  created:
    - src/lib/meta/schemas.ts
    - src/lib/meta/client.ts
    - src/lib/inngest/client.ts
    - src/lib/inngest/functions/sync-meta-ads.ts
    - src/app/api/inngest/route.ts
    - src/actions/trafego.ts
    - src/components/trafego/sync-button.tsx
  modified:
    - src/lib/db/schema.ts
    - src/app/(app)/trafego/page.tsx
    - .env.example
    - package.json
decisions:
  - "Inngest v4 createFunction usa triggers dentro do objeto options (nao como terceiro argumento separado)"
  - "uniqueIndex em meta_account_id para upsert seguro de contas"
  - "Campanhas agregadas por campaignId na tela (soma 7 dias) em vez de mostrar linha por dia"
  - "step.run com any type para step por limitacao de tipagem do Inngest v4 com triggers multiplos"
metrics:
  duration: 14min
  completed: "2026-07-11T22:12:00Z"
  tasks: 3
  files: 11
---

# Quick Task 260711-q7a: Integracao Meta Ads - tabelas, sync Inngest, tela real

Integracao completa Meta Marketing API v25.0: tabelas ad_accounts/campaign_insights, client fetch direto com Zod validation, Inngest sync (cron 6h + manual), Server Actions, tela /trafego com dados reais agrupados por conta.

## Tarefas Concluidas

| # | Tarefa | Commit | Arquivos-chave |
|---|--------|--------|----------------|
| 1 | Schema + migracao + Meta API client + Zod schemas | 584c87a | schema.ts, meta/client.ts, meta/schemas.ts, .env.example, package.json |
| 2 | Inngest setup + sync function + Server Actions | 1ce5441 | inngest/client.ts, sync-meta-ads.ts, api/inngest/route.ts, actions/trafego.ts |
| 3 | Tela /trafego com dados reais + botao sync | 81c9cc2 | trafego/page.tsx, trafego/sync-button.tsx |

## O que foi feito

### Schema (ad_accounts + campaign_insights)
- Tabela `ad_accounts`: uuid PK, cliente_id FK nullable, plataforma enum, meta_account_id text (unique index), nome, account_status, currency, ativo, timestamps
- Tabela `campaign_insights`: uuid PK, ad_account_id FK cascade, campaign_id, campaign_name, date, spend numeric(10,2), impressions/clicks/reach int, cpc/cpm numeric(10,4), ctr numeric(8,4), actions jsonb, synced_at
- Index composto `ci_account_date_campaign_idx` para upsert e queries
- Relations: adAccounts -> clientes, campaignInsights -> adAccounts, clientes -> adAccounts

### Meta API Client (fetch direto, sem SDK)
- `metaFetch()`: URL com versao pinada, access_token, monitora `X-Business-Use-Case-Usage` (warning acima 80%)
- `fetchMetaAdAccounts()`: busca owned_ad_accounts + client_ad_accounts, combina sem duplicatas, valida com Zod
- `fetchCampaignInsights()`: busca insights por conta (level=campaign, date_preset=yesterday), valida com Zod
- Zod schemas completos para todas as respostas da Meta API

### Inngest Setup
- Client singleton `sistema-jsr`
- Route handler `/api/inngest` (GET/POST/PUT)
- Funcao `syncMetaAds`: cron `0 6 * * *` + event `meta-ads/sync.requested`
- step.run por conta (retry individual), step.sleep 2s entre contas (rate limit)
- Upsert de contas e insights (verifica existencia antes de inserir/atualizar)

### Server Actions
- `getTrafegoData()`: contas ativas Meta com insights 7d, LEFT JOIN clientes, spendTotal calculado
- `triggerMetaSync()`: auth gate + inngest.send evento
- `getUltimaSync()`: max(synced_at) de campaign_insights

### Tela /trafego
- Reescrita completa sem mocks
- Header com ultima sync formatada (formatDistanceToNow pt-BR) + botao Sincronizar
- 3 StatCards: Gasto Total (7d), Contas Ativas, Campanhas (7d)
- Card por conta com nome, cliente associado, badge de status
- Tabela de campanhas agregadas (soma 7d por campaignId): nome, gasto, impressoes, cliques, CTR
- Estado vazio tratado com mensagem e botao de sync
- Formatacao: Intl.NumberFormat pt-BR para moeda e numeros

## Desvios do Plano

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inngest v4 API createFunction mudou assinatura**
- **Encontrado durante:** Task 2
- **Problema:** Inngest v4 aceita apenas 2 argumentos em createFunction (options + handler), triggers vao dentro do options
- **Correcao:** Movido triggers para dentro do primeiro objeto, tipado step como any
- **Arquivos:** src/lib/inngest/functions/sync-meta-ads.ts

**2. [Rule 3 - Blocking] npm install nao atualizou package.json no worktree**
- **Encontrado durante:** Task 1
- **Problema:** Worktree nao tinha package.json atualizado apos npm install
- **Correcao:** Adicionado inngest manualmente ao package.json, versao correta ^4.12.1
- **Arquivos:** package.json

## Known Stubs

Nenhum. Todos os dados vem de queries reais ao banco. A tela depende de um sync ter sido executado para mostrar dados (comportamento intencional — estado vazio tratado na UI).

## Self-Check: PASSED

- 11/11 arquivos encontrados
- 3/3 commits verificados (584c87a, 1ce5441, 81c9cc2)
- tsc --noEmit: sem erros
- npm run build: sucesso
