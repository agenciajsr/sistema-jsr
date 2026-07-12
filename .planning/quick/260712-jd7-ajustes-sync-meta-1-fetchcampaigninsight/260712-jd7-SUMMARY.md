---
phase: quick-260712-jd7
plan: 01
subsystem: trafego/meta
tags: [meta-ads, sync, timezone, brasilia, insights]
requires:
  - src/lib/meta/client.ts
  - src/lib/trafego/aggregate.ts
  - src/components/trafego/sync-button.tsx
provides:
  - "hojeBrasilia() e dataMenosDias() — datas YYYY-MM-DD no fuso America/Sao_Paulo"
  - "fetch da Meta com time_range ate hoje-BR (sem date_preset)"
  - "getResumoCliente com periodo no fuso de Brasilia"
  - "guard de cliente selecionado no botao Sincronizar agora"
affects:
  - /campanhas (filtros Hoje/Ontem)
  - sync manual da Meta
tech-stack:
  added: []
  patterns:
    - "Helper de data puro (Intl en-CA + ancora meio-dia UTC) para datas no fuso da conta sem drift de DST"
    - "time_range JSON string na Graph API para incluir o dia de hoje (date_preset last_30d nao inclui hoje)"
key-files:
  created:
    - src/lib/date-br.ts
    - src/lib/date-br.test.ts
  modified:
    - src/lib/meta/client.ts
    - src/lib/trafego/aggregate.ts
    - src/components/trafego/sync-button.tsx
decisions:
  - "Janela de fetch via time_range since=hoje-30d until=hoje-BR em vez de date_preset='last_30d', pois o preset NAO inclui o dia corrente"
  - "Base 'hoje' calculada no fuso America/Sao_Paulo (fuso da conta = data gravada), nao no fuso do servidor (UTC na Vercel)"
  - "dataMenosDias ancora em meio-dia UTC para evitar bordas de fuso/DST na aritmetica de dias"
metrics:
  duration: ~5min
  completed: 2026-07-12
---

# Quick 260712-jd7: Ajustes no Sync da Meta (incremento 1) Summary

Corrige dois problemas do sync da Meta sem migration nem dependencias novas: (1) filtros "Hoje/Ontem" sempre vazios — resolvido puxando dados ate hoje-BR via `time_range` e calculando o periodo no fuso de Brasilia; (2) botao "Sincronizar agora" puxava TODAS as contas sem cliente selecionado — agora exige cliente.

## O que foi feito

**Task 1 — Helper de data + time_range no client.ts (TDD)**
- Criado `src/lib/date-br.ts` com `hojeBrasilia()` (Intl en-CA no fuso `America/Sao_Paulo`) e `dataMenosDias(n, base)` (aritmetica ancorada em meio-dia UTC, sem drift de DST).
- Criado `src/lib/date-br.test.ts` (vitest, 5 casos: formato, dataMenosDias(0)===hoje, -30d, virada de mes).
- `fetchCampaignInsights` e `fetchAdInsights`: removido `datePreset`/`date_preset`, agora usam `time_range: JSON.stringify({ since, until })` com `until = hojeBrasilia()` e `since = dataMenosDias(30, until)`. Campaign mantem `time_increment: '1'`; ad continua uma linha agregada por anuncio. Assinatura reduzida a 1 argumento — callers existentes (route.ts, sync-meta-ads.ts) seguem validos.

**Task 2 — getResumoCliente no fuso de Brasilia**
- `getResumoCliente` usa `hojeBrasilia()`/`dataMenosDias()` para hoje/ontem/7d/30d, substituindo `new Date()` + `format`/`subDays` (fuso do servidor).
- Removido o import `date-fns` (`format`, `subDays`) — sem uso restante no arquivo (`getMetricasIntervalo` recebe intervalo explicito, nao usava).

**Task 3 — Guard no botao manual**
- `handleSync` retorna com `toast.warning(...)` em portugues quando nao ha `?cliente` na URL, antes de `setSyncing(true)` — nao dispara sync. `toast.warning` confirmado presente no sonner instalado.
- Com cliente selecionado, comportamento preservado (triggerMetaSync, polling, refresh). Cron/Inngest inalterado.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Verificacao

- `npx tsc --noEmit`: limpo.
- `npm test` (vitest): 7 arquivos, 67 testes, todos passam (inclui os 5 novos de date-br).
- `npm run build`: sucesso, sem erros novos.
- `npm run lint`: 3 erros + 6 warnings, TODOS pre-existentes e fora de escopo (ui/sidebar.tsx purity, hooks/use-mobile.ts set-state, `any` em sync-meta-ads.ts, unused vars em dashboard/data.ts — arquivo nao tocado, ultimo commit 60caee6). Nenhum dos arquivos alterados neste plano gera lint.
- Sem migration, sem dependencia nova.

## Known Stubs

Nenhum. O fetch real da Meta nao e testavel ponta-a-ponta aqui (depende de token), mas o codigo foi verificado por tipos e a logica de datas coberta por teste unitario.

## Self-Check: PASSED
- src/lib/date-br.ts — FOUND
- src/lib/date-br.test.ts — FOUND
- Commits f613413 (feat Task 1), 5cd2ec1 (fix Task 2), b8bcdeb (fix Task 3) — FOUND
