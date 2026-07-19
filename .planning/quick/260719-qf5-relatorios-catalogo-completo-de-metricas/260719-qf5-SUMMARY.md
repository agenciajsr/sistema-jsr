---
phase: quick-260719-qf5
plan: 01
subsystem: relatorios, crm
tags: [relatorios-configuraveis, catalogo-variaveis, engajamento, video, crm-origem]
requires: []
provides:
  - Categorias Engajamento e Vídeo no catálogo de variáveis dos relatórios configuráveis
  - Métricas videoViews/curtidasPagina agregadas em MetricasConta ponta a ponta
  - Origem editada na ficha do lead propagada para crm_oportunidades (cards do kanban)
affects: [relatorios, crm]
tech-stack:
  added: []
  patterns: [módulos puros sem db/auth/react, chaves catálogo 1:1 com contextoDeMetricas]
key-files:
  created: []
  modified:
    - src/lib/relatorios/parse-actions-extended.ts
    - src/lib/relatorios/gerar-relatorio.ts
    - src/lib/relatorios/engine.ts
    - src/lib/relatorios/engine.test.ts
    - src/lib/relatorios/variaveis.ts
    - src/actions/crm-lead.ts
decisions:
  - "Custos derivados (custo_por_engajamento, custo_por_clique_link, custo_por_video_view) retornam null quando o divisor é 0 — interpolação mostra '—' em vez de Infinity"
  - "Propagação de origem só roda quando v.origem !== undefined — demais campos da ficha não tocam oportunidades"
metrics:
  duration: ~10min
  tasks: 3
  completed: 2026-07-19
---

# Quick 260719-qf5: Relatórios — catálogo completo de métricas + origem ficha↔kanban — Summary

Catálogo dos relatórios configuráveis ganha categorias Engajamento e Vídeo (7 métricas novas com valores reais interpolados) e a origem editada na ficha do lead passa a propagar para as oportunidades do contato, que é o que o card do kanban lê.

## O que foi feito

### Task 1 — Parse e agregação (commit bf48355)
- `parse-actions-extended.ts`: grupos `VIDEO_VIEW_TYPES` (`video_view`) e `CURTIDAS_PAGINA_TYPES` (`like`); `MetricasRelatorio` e `parseActionsRelatorio` retornam `videoViews`/`curtidasPagina` (inclusive no fallback quando actions não é array).
- `gerar-relatorio.ts`: `MetricasConta` ganha os 2 campos; acumulados em `agregarContaPeriodo` e somados em `consolidarContas`.
- `engine.ts` `compilarBlocos`: idem (literal em 0 + soma no loop).
- `engine.test.ts`: helper `metricas()` com defaults 0.

### Task 2 — Catálogo e contexto (commit 55e9c2c)
- `variaveis.ts`: `CategoriaVariavel` + `'engajamento' | 'video'`; 7 entradas novas no `CATALOGO_VARIAVEIS` (engajamento, custo_por_engajamento, cliques_link, custo_por_clique_link, curtidas_pagina — numero/moeda; video_views, custo_por_video_view); `LABELS_CATEGORIA` (Engajamento/Vídeo); 7 linhas prontas em `LINHAS_METRICAS` com emoji.
- `engine.ts` `contextoDeMetricas`: expõe as 7 chaves novas, custos derivados com guarda de divisor 0 (null → '—').

### Task 3 — Origem ficha → kanban (commit 4b13ae1)
- `crm-lead.ts` `atualizarLead`: quando `v.origem !== undefined`, após atualizar `crm_contatos`, faz update em `crm_oportunidades` (`origem` + `updatedAt`) filtrado por `contatoId` + `workspaceId`, antes do `revalidatePath('/crm')`. Import de `crmOportunidades` já existia.

## Verificação
- `npx tsc --noEmit` sem erros (após cada task).
- `npx vitest run src/lib/relatorios` — 136 testes verdes.
- Cada chave nova aparece em CATALOGO_VARIAVEIS, LINHAS_METRICAS e contextoDeMetricas (conferido 1:1).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
- Arquivos modificados existem e compilam.
- Commits bf48355, 55e9c2c, 4b13ae1 presentes no histórico.
