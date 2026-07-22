---
quick_id: 260721-xa1
phase: quick
plan: 260721-xa1
subsystem: trafego / google-ads
tags: [google-ads, trafego, campanhas, dashboard, vinculo-conta]
title: Google Ads Parte 2c — mostrar Google nas telas + vincular conta a cliente
requires:
  - 260721-wyt (Parte 2b — sync engine grava contas+insights Google no formato Meta)
provides:
  - "Telas operacionais (Campanhas/Dashboard/Trafego) unificadas meta+google"
  - "Conta Google linkável a cliente pela UI existente (getContasNaoVinculadas)"
affects:
  - src/lib/trafego/aggregate.ts
  - src/lib/trafego/painel.ts
  - src/lib/trafego/acoes-dia.ts
  - src/actions/trafego.ts
key-files:
  modified:
    - src/lib/trafego/aggregate.ts
    - src/lib/trafego/painel.ts
    - src/lib/trafego/acoes-dia.ts
    - src/actions/trafego.ts
    - src/lib/relatorios/gerar-relatorio.ts
    - src/actions/relatorios.ts
    - src/actions/relatorio-configs.ts
    - src/lib/saude/avaliar-campanhas.ts
    - src/lib/alertas/regras-campanha.ts
decisions:
  - "9 queries de EXIBIÇÃO unificadas (removido filtro plataforma='meta'); 5 queries client-facing/Meta-específicas MANTIDAS com comentário justificando (adiado ao PASSO B)"
  - "Parse de actions/actionValues já é compatível com o formato Google (Parte 2b grava value como string) — zero código novo no parse"
metrics:
  tasks: 2
  files: 9
  completed: 2026-07-22
---

# Quick 260721-xa1: Google Ads Parte 2c — mostrar Google nas telas + vincular conta a cliente Summary

Remove os filtros `plataforma='meta'` das 9 queries de EXIBIÇÃO operacional (Campanhas/Dashboard/Trafego + dropdown de vínculo) para o Google Ads — já sincronizado pela Parte 2b nas MESMAS tabelas e no MESMO formato do Meta — encaixar por cliente; mantém deliberadamente o filtro nas 5 queries client-facing/Meta-específicas (relatórios, status de anúncio, alertas) até a validação de métricas do PASSO B.

## What Was Built

### Task 1 — 9 queries de exibição unificadas (commit ce2d57c)
Removido APENAS o predicado `eq(adAccounts.plataforma, 'meta')` de dentro do `and(...)`, mantendo os demais predicados intactos:

| # | Arquivo | Função | Efeito |
|---|---------|--------|--------|
| 1 | aggregate.ts | getInvestido30dPorCliente | investido dos cards de /campanhas e dashboard |
| 2 | aggregate.ts | listarClientesComContas | lista de clientes de /campanhas/dashboard (JSDoc atualizado p/ "Meta ou Google") |
| 3 | aggregate.ts | getResumoCliente | resumo unificado por cliente |
| 4 | aggregate.ts | getMetricasIntervalo | métricas de intervalo/comparação por cliente |
| 5 | painel.ts | getResumoLandingPorCliente | resumo landing por cliente |
| 6 | painel.ts | getPainelCampanhas | painel detalhado de /campanhas |
| 7 | acoes-dia.ts | (contas do cliente) | ações do dia por cliente |
| 8 | actions/trafego.ts | getTrafegoData | tela /trafego |
| 9 | actions/trafego.ts | getContasNaoVinculadas | conta Google agora aparece no dropdown de vínculo (JSDoc atualizado p/ "qualquer plataforma") |

`vincularContaAoCliente` (filtra por `adAccounts.id`) e `getContasDoCliente` (sem filtro de plataforma) confirmados agnósticos — não tocados.

Onde o `and(...)` ficou com um único predicado após a remoção (listarClientesComContas, getResumoLandingPorCliente, getTrafegoData), simplificado para `.where(eq(adAccounts.ativo, true))`.

### Task 2 — 5 queries que MANTÊM 'meta', documentadas (commit 7b42b90)
Lógica intacta (continuam filtrando 'meta'); adicionado comentário na linha acima do predicado explicando a decisão:

| Arquivo | Site | Motivo do MANTER |
|---------|------|------------------|
| relatorios/gerar-relatorio.ts | ~L263 | relatório client-facing; mapeamento Google não validado (PASSO B) |
| actions/relatorios.ts | ~L65 | geração de relatório (mesmo motivo) |
| actions/relatorio-configs.ts | ~L333 | config de relatório (mesmo motivo) |
| saude/avaliar-campanhas.ts | ~L343 | buscarAdsStatus lê ad_insights, populado SÓ pelo sync Meta (Google não grava ad_insights) |
| alertas/regras-campanha.ts | ~L275 | alertas avaliam métricas contra metas; métricas Google não validadas gerariam alertas errados |

## Conferência do parse Google (resultado)

**Encaixou — zero código novo no parse.** Verificado em `src/lib/trafego/metricas.ts` contra o que a Parte 2b (`src/lib/google/ads-sync.ts`) realmente grava:

- Google grava `actions = [{ action_type: 'lead', value: String(conversions) }]` — INCLUI `value` como string. O guard `isActionItem` exige `action_type` e `value` como strings; a linha Google PASSA no guard (a nota do plano `[{action_type:'lead'}]` era simplificada — o código real inclui o `value`).
- `parseActions` → `somarGrupo(..., LEADS_TYPES)` contém `'lead'` → `leads = conversions`. ✅
- `actionValues = [{ action_type: 'purchase', value: String(conversionsValue) }]` → `parseActionValues` usa `VENDAS_TYPES` que contém `'purchase'` → receita/ROAS corretos. ✅
- Unidades já normalizadas no sync Google (spend = cost_micros/1e6; ctr ×100; cpc/cpm /1e6) — nenhum cálculo de spend/cpc/cpm/ctr em metricas.ts assume nada exclusivo do Meta.
- `parseActions`/`parseActionValues` retornam tudo 0 para null/não-array (Google grava `null` quando conversions=0) — nunca lançam.

Nenhuma incompatibilidade encontrada.

## Verification

Rodado no worktree (node_modules via junction para o checkout principal):

- `npx tsc --noEmit` → **0 erros**
- `npx eslint src/lib/trafego src/actions/trafego.ts --max-warnings=0` (folders estruturalmente alteradas, Task 1) → **0 issues**
- `npx vitest run` → **PASS 649 / FAIL 0** (mesma contagem da Parte 2b — nenhum número Meta regrediu)
- Grep de sanidade: `eq(adAccounts.plataforma, 'meta')` NÃO existe mais em aggregate.ts/painel.ts/acoes-dia.ts/actions/trafego.ts; existe (com comentário) nos 5 sites de relatórios/saúde/alertas.

## Deviations from Plan

Nenhuma alteração de lógica além do planejado.

### Deferred Issues (out of scope — SCOPE BOUNDARY)

Ao rodar `eslint` nos 2 arquivos de relatório onde SÓ adicionei comentários (Task 2), apareceram 4 warnings `@typescript-eslint/no-unused-vars` PRÉ-EXISTENTES (imports/vars mortos: `hojeBrasilia`, `dataMenosDias`, `err`, `MetricasRelatorio`). Adicionar uma linha de comentário não cria unused-var — são anteriores a esta tarefa e fora do escopo (o plano deliberadamente rodou só tsc+vitest na Task 2). Registrados em `deferred-items.md`; não corrigidos. 0 erros, não bloqueiam build. As pastas estruturalmente alteradas (Task 1) passam eslint com 0.

## Known Stubs

Nenhum. A mudança é estrutural (remover filtro); a única conta Google linkada hoje está vazia (0 campanhas), então nenhuma linha Google entra nas agregações e os números Meta são idênticos. O Google encaixa automaticamente quando houver dado.

## Self-Check: PASSED
