---
quick_id: 260721-wny
title: Google Ads Parte 2a — client REST (v21) + Testar conexão (lista contas da MCC)
date: 2026-07-21
status: complete
---

# Quick Task 260721-wny — Summary

## Objetivo

Fundação do sync do Google Ads + prova de conexão de ponta a ponta (token + OAuth +
MCC), antes de puxar campanhas.

## O que foi feito

- **`lib/google/ads-client.ts`** — client REST (espelha o padrão do Meta, fetch
  direto, sem SDK): `getAdsApiVersion` (default **v21** — v20 descontinuada),
  `adsSearch` (GAQL `googleAds:search` com developer-token + login-customer-id +
  bearer via `getValidAdsAccessToken`), `listarContasDaMcc` (customer_client),
  `adsSyncConfigurado`. Só LEMOS (GAQL), nunca alteramos.
- **`actions/google-ads.ts`** — `testarConexaoGoogleAds`: valida conectado + env,
  lista as contas da MCC, mensagens claras por pré-requisito.
- **`components/integracoes/testar-google-ads.tsx`** — botão "Testar conexão" que
  mostra as contas (gerenciadora vs conta de anúncio).
- **`/integracoes`** — botão aparece no card do Google Ads quando conectado E env ok.

## Verificação

- Provado LOCALMENTE contra a MCC real (225-515-6295, v21): 2 contas retornadas —
  "MCC - Jacson Tráfego Pago" (gerenciadora) + "Conta de Anúncios do Jacson" (conta
  de anúncio, id 8074565139).
- `npx tsc --noEmit` → No errors found.
- `npx eslint` (tocados) → No issues found.
- `npx vitest run` → 649 pass / 0 fail.
- Sem migration.

## Observações / pendências

- ⚠️ Para o botão funcionar EM PRODUÇÃO, faltam os env na Vercel:
  `GOOGLE_ADS_DEVELOPER_TOKEN` e `GOOGLE_ADS_LOGIN_CUSTOMER_ID=2255156295`.
  (Localmente já estão no .env.local, gitignored.)
- Só 1 conta de anúncio vinculada à MCC hoje ("Conta de Anúncios do Jacson"). Se a
  agência gerencia outros clientes no Google Ads, vincular as contas deles à MCC
  para aparecerem no sync.

## Próximo (Parte 2b — sync)

Espelhar o sync do Meta: para cada conta de anúncio da MCC (gerenciadora=false),
GAQL sobre campaign/campaign_budget/metrics (últimos 30 dias) → gravar em
ad_accounts/campaign_insights com plataforma='google'; carona no cron; degradação
graciosa. Depois, mostrar Google junto do Meta nas telas (campanhas/verbas/dashboard).
