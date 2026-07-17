---
phase: quick-260717-pvr
plan: 01
subsystem: crm
tags: [polling, quase-tempo-real, toast, router-refresh, dnd-kit]
requires: [getCrmVisaoGeral, CrmView, KanbanCrm]
provides:
  - useRefreshPeriodico (hook reutilizável de polling leve)
  - detectarNovasOportunidades / rotuloNovidade (módulo puro testado)
  - /crm quase tempo real com toast de novo lead
affects: [/crm]
tech-stack:
  added: []
  patterns: [polling pausável via ref, diff de ids entre renders, reset otimista intacto]
key-files:
  created:
    - src/lib/crm/novidades.ts
    - src/lib/crm/novidades.test.ts
    - src/hooks/use-refresh-periodico.ts
  modified:
    - src/components/crm/crm-view.tsx
    - src/components/crm/kanban-crm.tsx
    - src/components/crm/novo-lead-dialog.tsx
decisions:
  - "Polling reusa router.refresh() → getCrmVisaoGeral (sem endpoint novo, sem Supabase Realtime)"
  - "pausado lido via ref: interval/listeners criados 1x, mudanças de estado não recriam nada"
  - ">3 leads novos num ciclo viram toast-resumo (evita spam em importação em massa)"
metrics:
  duration: ~20min
  completed: 2026-07-17
---

# Quick 260717-pvr: CRM quase tempo real (polling leve + refresh no foco + toast de novo lead) Summary

Polling leve de 30s (só aba visível, pausável) + refresh imediato ao voltar o foco (throttle 5s) na /crm via router.refresh(), com toast "Novo lead: <nome>" por diff de ids entre renders — sem endpoint novo nem Realtime.

## O que foi feito

### Task 1 — Módulo puro + hook (commit 02c3c4c)
- `src/lib/crm/novidades.ts`: `detectarNovasOportunidades(idsAnteriores: Set<string> | null, atuais)` — `null` = primeira carga (nunca toasta); remoções não geram novidade. `rotuloNovidade` = contatoNome (trim) ou fallback no titulo. 7 testes vitest.
- `src/hooks/use-refresh-periodico.ts`: `useRefreshPeriodico({ pausado, intervaloMs = 30_000 })` — setInterval que só chama `router.refresh()` com `document.visibilityState === 'visible'` e `!pausado`; listeners `visibilitychange` + `focus` disparam refresh imediato com throttle de 5s (ref de timestamp); `pausado` via ref (não recria interval); cleanup completo.

### Task 2 — Integração no CrmView (commit 482ba8a)
- `KanbanCrm`: prop opcional `onArrastandoChange`, chamada em `onDragStart(true)`, no topo do `onDragEnd(false)` (antes de qualquer early-return) e em `onDragCancel(false)` (adicionado — Esc/perda de foco também despausa).
- `NovoLeadDialog`: prop opcional `onOpenChange` notificada por um helper `mudarAberto` (único ponto de mudança do open); comportamento existente intacto.
- `CrmView`: `pausado = arrastando || novoLeadAberto || dialogPipeline !== null || dialogEtapas || confirmarExcluirPipeline`; `useRefreshPeriodico({ pausado })`; useEffect sobre `dados.colunas`/`dados.colunasFechadas` monta o array plano, diffa contra `useRef<Set<string> | null>` e toasta `Novo lead: <rotulo>` — mais de 3 novidades num ciclo viram um toast-resumo "X novos leads chegaram no CRM.".
- /funil verificado: hoje é o Dashboard Comercial próprio (não redirect) — fora do escopo conforme o plano; nada aplicado lá.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] onDragCancel também sinaliza fim do drag**
- **Found during:** Task 2
- **Issue:** o plano citava só onDragStart/onDragEnd; um drag cancelado (Esc) deixaria o polling pausado para sempre.
- **Fix:** `onDragCancel` no DndContext zera `arrastandoId` e chama `onArrastandoChange(false)`.
- **Commit:** 482ba8a

## Verificação

- `npx vitest run` — 2904 testes verdes (7 novos em novidades.test.ts)
- `npx tsc --noEmit` — sem erros
- `npm run build` — verde
- Sem endpoint novo, sem mudança em getCrmVisaoGeral, sem migration
- Não foi feito git push (conforme restrição)

## Known Stubs

Nenhum — todo o fluxo está ligado a dados reais.

## Self-Check: PASSED

- src/lib/crm/novidades.ts — FOUND
- src/lib/crm/novidades.test.ts — FOUND
- src/hooks/use-refresh-periodico.ts — FOUND
- commits 02c3c4c e 482ba8a — FOUND
