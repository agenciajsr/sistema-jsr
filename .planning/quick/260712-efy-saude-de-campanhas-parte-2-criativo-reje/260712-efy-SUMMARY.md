---
phase: quick-260712-efy
plan: 01
subsystem: saude-campanhas
tags: [meta-ads, alertas, health-score, criativo, migration]
requires:
  - "ad_insights (tabela existente)"
  - "getAlertas / avaliarSaudeCliente (Saúde de Campanhas Parte 1)"
provides:
  - "ad_insights.frequency + ad_insights.effective_status (colunas nullable)"
  - "fetchAdMeta (thumbnail + effective_status por adId, best-effort)"
  - "Sinais criativo_rejeitado e fadiga_criativo integrados ao Health Score"
affects:
  - "getAlertas (dashboard, /alertas, ficha do cliente)"
  - "sync Meta Ads (Inngest + route.ts)"
tech-stack:
  added: []
  patterns:
    - "Sinais de criativo avaliados fora do gate de gasto agregado (verba parada por criativo reprovado ainda gera alerta)"
    - "Degradação graciosa: colunas nulas (pré-sync) → nenhum alerta novo, sem quebrar"
key-files:
  created:
    - "drizzle/0006_cooing_speed.sql"
  modified:
    - "src/lib/db/schema.ts"
    - "src/lib/meta/schemas.ts"
    - "src/lib/meta/client.ts"
    - "src/lib/inngest/functions/sync-meta-ads.ts"
    - "src/app/api/sync-meta/route.ts"
    - "src/lib/alertas/types.ts"
    - "src/app/(app)/alertas/page.tsx"
    - "src/components/dashboard/alertas-importantes.tsx"
    - "src/lib/saude/avaliar-campanhas.ts"
    - "src/lib/saude/avaliar-campanhas.test.ts"
decisions:
  - "FREQ_FADIGA = 3.5 e FADIGA_MIN_IMPRESSIONS = 1000 como limiares de fadiga"
  - "fetchAdThumbnails renomeada para fetchAdMeta (retorno { thumbnailUrl, effectiveStatus })"
  - "Sinais de criativo independem do gasto agregado (avaliados antes do gate spend<=0)"
metrics:
  duration: 11min
  tasks: 5
  files: 10
  completed: "2026-07-12"
---

# Phase quick-260712-efy Plan 01: Saúde de Campanhas Parte 2 (Criativo Rejeitado + Fadiga) Summary

Dois novos sinais de saúde de campanha — CRIATIVO REJEITADO (status de aprovação do anúncio na Meta) e FADIGA DE CRIATIVO (frequência alta com volume mínimo) — puxados de campos que a Meta não coletava (`frequency`, `effective_status`), gravados no sync e integrados ao Health Score da Parte 1, com degradação graciosa quando os campos ainda estão nulos.

## O que foi feito

- **Task 1 — Schema + migration:** `ad_insights` ganhou `frequency` (numeric 8,4 nullable) e `effective_status` (text nullable). Migration `drizzle/0006_cooing_speed.sql` gerada contendo **apenas** os 2 `ADD COLUMN` — **NÃO aplicada** (o orquestrador aplica).
- **Task 2 — Meta client:** `metaAdInsightSchema` aceita `frequency` (string opcional) e `reach`; `fetchAdInsights` inclui `frequency,reach` nos fields; `fetchAdThumbnails` → `fetchAdMeta` retornando `Map<adId, { thumbnailUrl, effectiveStatus }>` best-effort (nunca lança).
- **Task 3 — Sync:** o upsert de `ad_insights` (Inngest `sync-meta-ads.ts` **e** também `app/api/sync-meta/route.ts`) grava `frequency`, `effectiveStatus` e `reach`; pausa de 2s entre contas preservada.
- **Task 4 — Tipos/wire:** `TipoAlerta` ganhou `criativo_rejeitado` e `fadiga_criativo`; os 3 Records exaustivos (`TIPO_ICON`/`TIPO_LABEL` em /alertas, `TIPO_HREF` no dashboard) completados em pt-BR (ícones `ImageOff`/`Repeat`).
- **Task 5 — Avaliação (TDD):** `avaliarSaudeCliente` emite `criativo_rejeitado` (crítico p/ DISAPPROVED, atenção p/ WITH_ISSUES, máx. 1, prioriza crítico) e `fadiga_criativo` (frequency ≥ 3.5 e impressions ≥ 1000, maior frequência vence, máx. 1); `penalidade()` com casos explícitos; `buscarAdsStatus` injeta os ads (linha mais recente por adId) nos orquestradores `getAlertasCampanhas` e `getSaudeDoCliente`.

## Migration a aplicar (para o orquestrador)

- **Arquivo:** `drizzle/0006_cooing_speed.sql`
- **Conteúdo:** 2 `ALTER TABLE "ad_insights" ADD COLUMN` (`effective_status text`, `frequency numeric(8,4)`)
- **Comando:** `npx drizzle-kit migrate` (usa `DIRECT_URL`, porta 5432) — ou aplicar o `.sql` manualmente. Migration aditiva e nullable, segura para rodar em produção sem downtime.

## Decisões

- **FREQ_FADIGA = 3.5 / FADIGA_MIN_IMPRESSIONS = 1000:** limiares nomeados junto dos thresholds da Parte 1; volume mínimo evita ruído em anúncios de baixa entrega.
- **Sinais de criativo fora do gate de gasto:** avaliados antes do `if (atual.spend <= 0) return`, porque um criativo reprovado costuma ser justamente a causa da verba parada — o alerta precisa aparecer mesmo com gasto agregado zero.
- **`fetchAdThumbnails` → `fetchAdMeta`:** um único endpoint `/ads` (`fields=id,effective_status,creative{thumbnail_url}`) traz thumbnail e status juntos, evitando uma chamada extra.

## Degradação graciosa

Quando `effective_status` e `frequency` estão nulos (antes de um novo sync gravar os campos), nenhum sinal novo é gerado e a avaliação não quebra. `buscarAdsStatus` está envolto em try/catch retornando `[]` em qualquer erro (colunas ausentes/consulta falha) — comportamento coberto por teste.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Segundo chamador de fetchAdThumbnails não previsto no plano**
- **Found during:** Task 3
- **Issue:** O plano dizia que o único chamador de `fetchAdThumbnails` era o sync Inngest, mas `src/app/api/sync-meta/route.ts` também o usava — o rename quebrava o tsc.
- **Fix:** `route.ts` atualizado para `fetchAdMeta`, gravando também `effectiveStatus`, `frequency` e `reach` (paridade com o sync Inngest).
- **Files modified:** `src/app/api/sync-meta/route.ts`
- **Commit:** e6f4c1a

**2. [Rule 1 - Lint] prefer-const em nextUrl de fetchAdInsights**
- **Found during:** verificação final (lint)
- **Issue:** `let nextUrl` nunca reatribuído em `fetchAdInsights` (pré-existente, mas dentro de função editada nesta task) gerava erro `prefer-const`.
- **Fix:** `let` → `const`.
- **Files modified:** `src/lib/meta/client.ts`
- **Commit:** 3ea15c7

## Deferido

- **Badge "Reprovado" no card de criativo** (`src/components/trafego/criativos-campeoes.tsx`): exigiria propagar `effectiveStatus` por `getResumoCliente`/`CriativoRanking` em `aggregate.ts` (toca tipos e query). Deixado para os alertas cobrirem o aviso; pode ser um incremento futuro.

## Verificação

- `npx tsc --noEmit`: limpo.
- `npm test` (vitest): 62 passed (6 arquivos) — inclui 6 testes novos de criativo_rejeitado/fadiga + 2 de health score.
- `npm run build`: sucesso.
- `npm run lint`: 3 erros restantes, **todos** nos arquivos tolerados/conhecidos (`ui/sidebar.tsx`, `hooks/use-mobile.ts`, o `any` de `sync-meta-ads.ts`) + 6 warnings pré-existentes. Nenhum erro/warning novo introduzido.
- Migration `0006_cooing_speed.sql`: apenas 2 ADD COLUMN em ad_insights, **não aplicada**.

## Commits

- cedc978 — feat: schema frequency + effective_status (Task 1)
- f4f39d1 — feat: meta client puxa frequency/reach + fetchAdMeta (Task 2)
- e6f4c1a — feat: sync grava novos campos (Task 3 + route.ts)
- 25d0225 — feat: TipoAlerta + Records exaustivos (Task 4)
- b233c25 — test: RED criativo_rejeitado/fadiga (Task 5)
- 72d4bba — feat: sinais no health score (Task 5 GREEN)
- 3ea15c7 — refactor: prefer-const nextUrl

## Self-Check: PASSED

- Arquivos criados/modificados: todos presentes (schema.ts, 0006_cooing_speed.sql, client.ts, avaliar-campanhas.ts, avaliar-campanhas.test.ts, etc.).
- Commits: cedc978, f4f39d1, e6f4c1a, 25d0225, b233c25, 72d4bba, 3ea15c7 — todos existem no histórico.
</content>
</invoke>
