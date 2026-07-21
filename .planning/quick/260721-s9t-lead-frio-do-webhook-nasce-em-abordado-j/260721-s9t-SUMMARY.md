---
quick_id: 260721-s9t
title: Lead frio do webhook nasce em "Abordado" (já abordado) + carimba 1º contato
date: 2026-07-21
status: complete
---

# Quick Task 260721-s9t — Summary

## Objetivo

Corrigir a etapa de entrada do lead frio: o webhook do disparo (WhatsApp) chega
DEPOIS que a 1ª mensagem foi enviada, logo o lead JÁ foi abordado — deveria cair em
"Abordado", não em "A Abordar". Assim o relógio do follow-up D1 (24h) começa sozinho.

## O que foi feito

`src/lib/crm/ingest.ts` (processarLead):
- No funil "Prospecção Fria", a etapa de entrada passou de "A Abordar" (1ª etapa,
  ordem 0) para **"Abordado"** (busca por nome via `ehEtapaAbordado`).
- O lead nasce com `primeiro_contato_em` carimbado (data atual) → dispara o relógio
  de 24h do D1 automaticamente (a cadência de follow-up já corre em "Abordado").
- **Fallbacks seguros:** se o pipeline frio não existir (seed não aplicado) ou a
  etapa "Abordado" não existir (seed antigo), cai no comportamento atual (1ª etapa,
  SEM carimbo) — `carimbarContato` só é true quando de fato caiu em "Abordado".
- Funil de **Vendas (inbound) inalterado** — a mudança só toca o ramo `nasceuNoFrio`.

## Modelo de uso resultante

- **WhatsApp (webhook, automático):** lead nasce em "Abordado" já com 1º contato →
  D1 aparece sozinho após 24h.
- **Instagram (manual, futuro):** cadastra a lista em "A Abordar" e move p/ "Abordado"
  ao mandar a DM (mover de etapa também carimba o 1º contato — crm.ts:541).

## Verificação

- `npx tsc --noEmit -p tsconfig.json` → No errors found.
- `npx vitest run` → 649 pass / 0 fail (sem regressão).

## Notas

- Sem migration / sem toque no banco — só lógica de ingestão.
- `ETAPA_INICIAL_FRIO` ('A Abordar') mantida em roteamento.ts: continua sendo a
  entrada MANUAL; só o webhook deixou de usá-la.
- Não afeta os leads já existentes (14 em "Abordado", 15 em "A Abordar"); vale para
  os PRÓXIMOS leads que chegarem pelo webhook.
