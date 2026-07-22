---
quick_id: 260721-up2
title: Forma de pagamento MANUAL por conta de anúncio (Verbas)
date: 2026-07-21
status: complete
---

# Quick Task 260721-up2 — Summary

## Descoberta que motivou (sondagem à Graph API)

O usuário queria ver a forma de pagamento (cartão/Pix/depósito) das contas nas Verbas.
Sondagem read-only à Graph API v25.0 (com o System User token de produção) provou que
o **Meta bloqueia esse dado**:
- `funding_source_details{type,display_string}` → **Permission Denied (#10)**
- `funding_source` (campo antigo) → vem VAZIO (só o id)
- `spend_cap/amount_spent`, `account_status`, `currency` → funcionam normal

Ou seja: não é bug nosso — dados de cobrança ficam atrás de papel de "Finanças" no BM,
que o System User não tem. Decisão do usuário: **registrar à mão** (info estática).

## O que foi feito

- **schema + migration 0042 (APLICADA):** coluna `ad_accounts.forma_pagamento_manual`
  (text). Valores: `cartao_credito | pix_deposito | boleto | faturamento | null`.
- **`actions/trafego.ts`:** `atualizarFormaPagamentoConta(adAccountId, forma)` — valida
  contra a lista canônica, revalida /verbas, degradação graciosa.
- **`components/verbas/forma-pagamento-select.tsx`:** seletor editável (client) com
  atualização OTIMISTA (reflete na hora, rollback + toast em erro), sem router.refresh.
- **`verbas/page.tsx`:** a coluna "Pagamento" passou a renderizar o seletor por conta;
  removido o `FUNDING_LABELS` morto (baseado no funding_source do Meta = null) e imports
  órfãos pré-existentes (and/sql/isNotNull/Progress + CreditCard/Landmark).

## Verificação

- `npx tsc --noEmit` → No errors found.
- `npx eslint` (arquivos tocados) → No issues found.
- `npx vitest run` → 649 pass / 0 fail.
- Migration 0042 aplicada e confirmada no banco.

## Follow-up (se um dia quiserem o automático)

Dar papel de "Finanças" ao System User no Business Manager e re-sondar
`funding_source_details`. Se o Meta liberar, dá pra wirar o automático (e o campo
manual vira fallback). Hoje está fora do nosso alcance técnico.
