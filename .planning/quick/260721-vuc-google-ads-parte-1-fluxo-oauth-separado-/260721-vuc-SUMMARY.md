---
quick_id: 260721-vuc
title: Google Ads Parte 1 — fluxo OAuth "Conectar Google Ads" (separado da Agenda)
date: 2026-07-21
status: complete
---

# Quick Task 260721-vuc — Summary

## Objetivo

Primeira fatia da integração com o Google Ads: o fluxo OAuth para autorizar a
conta que gerencia a MCC da agência. Construído SEPARADO do OAuth da Agenda
(Calendar) para não arriscar a conexão que já funciona.

Contexto: a agência já roda Google Ads; MCC = 225-515-6295; developer token com
nível "Análises" (= Explorer, 2026) que já permite LER contas reais (2.880 ops/dia,
sem espera de aprovação). Só lemos relatórios.

## O que foi feito

- **schema + migration 0043 (APLICADA):** tabela `google_ads_credentials`
  (single-tenant, espelha `google_credentials`).
- **`lib/google/ads-oauth.ts`:** escopo `adwords`, redirect próprio
  (`/api/integrations/google-ads/callback`), `buildAdsAuthUrl`, `exchangeAdsCode`.
- **`lib/google/ads-credentials.ts`:** `getAdsCredentials`/`isAdsConnected`/
  `saveAdsCredentials`/`deleteAdsCredentials`/`getValidAdsAccessToken` (refresh
  automático reusando `refreshAccessToken` de oauth.ts).
- **rotas** `api/integrations/google-ads/start` + `callback` (cookie de state
  próprio `google_ads_oauth_state` — não colide com a Agenda).
- **`actions/integracoes-google.ts`:** `desconectarGoogleAds` (revoga + apaga,
  não toca na Agenda).
- **`/integracoes`:** card "Google Ads" com Conectar/Desconectar + status + aviso
  de env faltando para o sync.

## Verificação

- `npx tsc --noEmit` → No errors found.
- `npx eslint` (arquivos tocados) → No issues found.
- `npx vitest run` → 649 pass / 0 fail.
- Migration 0043 aplicada e confirmada.

## ⚠️ PRÉ-REQUISITOS DO USUÁRIO (o botão Conectar só funciona depois disto)

**No Google Cloud Console** (o projeto que tem o GOOGLE_CLIENT_ID da Agenda):
1. **Ativar a "Google Ads API"** (APIs & Services → Library → Google Ads API → Enable).
2. **Tela de consentimento OAuth** → adicionar o escopo
   `https://www.googleapis.com/auth/adwords`.
3. **Credentials → o OAuth Client** → adicionar o **Authorized redirect URI**:
   `https://<dominio-de-producao>/api/integrations/google-ads/callback`
   (e o de localhost para testar em dev, se for o caso).
4. Se a tela de consentimento estiver em **"Testing"**, adicionar a conta Google
   dona da MCC como **test user** (evita o processo de verificação por enquanto).

**Na Vercel (env) — necessário só para a Parte 2 (sync), não para conectar:**
- `GOOGLE_ADS_DEVELOPER_TOKEN` = <token> (secreto)
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = 2255156295 (MCC sem hífens)

## Próximo (Parte 2)

Instalar client do Google Ads (ou REST + google-auth), montar o sync via GAQL
(campaign/campaign_budget/metrics) gravando em ad_accounts/campaign_insights com
plataforma='google', carona no cron, e mostrar Google junto do Meta nas telas.
Primeiro passo da Parte 2: um "testar conexão" que lista as contas acessíveis sob
a MCC (prova a cadeia token + OAuth + MCC).
