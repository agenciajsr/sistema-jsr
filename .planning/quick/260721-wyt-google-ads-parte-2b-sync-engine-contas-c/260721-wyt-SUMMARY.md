---
quick_id: 260721-wyt
title: Google Ads Parte 2b — sync engine (contas + campanhas) + carona no cron
date: 2026-07-21
status: complete
---

# Quick Task 260721-wyt — Summary

## O que foi feito

- **`lib/google/ads-sync.ts`** (espelha lib/meta/sync.ts, grava nas MESMAS tabelas):
  - `atualizarListaContasGoogle`: contas de anúncio sob a MCC (gerenciadora=false) →
    upsert em `ad_accounts` (plataforma='google'; customer id na coluna meta_account_id;
    cliente_id null p/ vincular na UI depois).
  - `syncSingleAccountGoogle`: GAQL campaign daily (30d) → upsert `campaign_insights`.
    Mapeamento: cost_micros/1e6→spend; average_cpc/cpm/1e6; ctr×100 (Google dá fração,
    Meta grava %); conversions → `actions=[{action_type:'lead'}]` (uso lead-gen da
    agência — encaixa na máquina de resultados do Meta); conversions_value →
    `actionValues=[{purchase}]` p/ ROAS; advertising_channel_type→objective;
    status→effective_status.
  - `sincronizarTudoGoogle`: orquestra, degradação graciosa por conta.
- **cron `sync-meta`**: carona com try/catch próprio; só roda quando conectado E com
  env (developer token + MCC). Não quebra o sync do Meta.

## Verificação

- Testado LOCAL contra a MCC real: 1 conta descoberta e gravada em ad_accounts
  (plataforma='google', "Conta de Anúncios do Jacson" 8074565139, cliente_id null).
- **0 insights** — porque essa (única) conta linkada na MCC NÃO tem campanhas (query
  de campanhas retornou 200 com 0 resultados). Sync CORRETO, sem dado a puxar.
- `npx tsc --noEmit` → No errors found; `eslint` → 0; `vitest` → 649/0.

## ⚠️ Limitação / validação pendente

- O mapeamento de MÉTRICAS (spend/cpc/cpm/ctr/conversions→leads) foi escrito conforme
  a doc do Google, mas **ainda NÃO foi validado contra uma conta com campanhas reais**
  (nenhuma linkada na MCC tem dado). Conferir os números quando houver uma conta ativa.
- **Ação do usuário:** para ver dados reais, vincular na MCC (225-515-6295) as contas
  de Google Ads dos clientes que TÊM campanhas ativas. Hoje só há 1 conta vazia.

## Onde já aparece / próximo (2c)

- **Verbas** já lista TODAS as ad_accounts ativas (sem filtro de plataforma) → a conta
  Google já aparece lá.
- **Campanhas/Dashboard** filtram plataforma='meta' (listarClientesComContas) → NÃO
  mostram Google ainda. Fazer Google aparecer nessas telas (+ vincular a cliente) é a
  Parte 2c.
