---
phase: quick-260719-s3a
plan: 01
subsystem: crm
tags: [crm, follow-up, kanban, temperatura, migration-0037, tdd]
requires: [quick-260717-qq6 (primeiro_contato_em/SLA), quick-260716-khp (MotivoPerdaDialog)]
provides:
  - Etapa "Follow-up" seedada idempotente no pipeline Vendas (via script 0037)
  - Aba Follow-up na /crm com kanban D1..D6 + Perdido (card único por followup_nivel)
  - Pendências de follow-up com prazos crescentes na família visual do SLA
  - Chip de temperatura 🔥/🧊 derivado da origem em todos os cards
affects: [/crm, src/actions/crm.ts, getCrmVisaoGeral]
tech-stack:
  added: []
  patterns: [módulo puro sob TDD, degradação graciosa a migration pendente, drag otimista com rollback]
key-files:
  created:
    - drizzle/0037_crm_followup.sql
    - scripts/aplicar-migration-0037.ts
    - src/lib/crm/followup.ts
    - src/lib/crm/followup.test.ts
    - src/lib/crm/temperatura.ts
    - src/lib/crm/temperatura.test.ts
    - src/components/crm/kanban-followup.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/crm/dados.ts
    - src/actions/crm.ts
    - src/components/crm/card-oportunidade.tsx
    - src/components/crm/crm-view.tsx
decisions:
  - "Temperatura DERIVADA na leitura (função pura da origem) — sem coluna nova nem backfill; leads antigos ganham o chip automaticamente"
  - "Seed da etapa Follow-up SÓ no script TS (UPDATE das ordens + INSERT precisam ser atômicos/condicionais); o .sql tem só as colunas"
  - "followup_nivel NUNCA é zerado ao sair da etapa (histórico); voltar não rebaixa; entrada em D1 só se null (idempotente)"
  - "D6 vencido = destaque 'Follow-ups esgotados'; mover para Perdido é SEMPRE decisão humana"
metrics:
  duration: ~25min
  tasks: 3
  completed: 2026-07-19
---

# Quick 260719-s3a: Sistema de Follow-up no CRM (etapa + visão D1-D6 + temperatura) Summary

Follow-up estruturado no CRM de vendas: etapa "Follow-up" seedada após "Contato Feito", aba com kanban D1..D6 + Perdido derivado de `followup_nivel` (card único, sem clone), pendências com prazos crescentes 24h/48h/72h/5d/7d/14d na família visual do SLA, e chip 🔥/🧊 automático por origem — regras puras sob TDD (24 testes novos).

## O que foi feito

### Task 1 — Migration 0037 + módulos puros (TDD)
- `src/lib/crm/followup.ts`: `PRAZOS_FOLLOWUP_HORAS` {1:48, 2:72, 3:120, 4:168, 5:336, 6:336}, `ehEtapaFollowup` (tolera 'follow up'/'follow-up'/'followup'), `ehEtapaContatoFeito`, `pendenciaFollowup` (24h em Contato Feito → pendente; níveis 1-5 pelo prazo do nível; nível 6 → esgotado; limite EM PONTO vence; só status 'aberta').
- `src/lib/crm/temperatura.ts`: `temperaturaOrigem` — meta_lead_ad/landing_page = quente; prospeccao_fria/whatsapp = frio; demais = null.
- Schema: `followupNivel` (integer) + `ultimoFollowupEm` (timestamptz) em `crmOportunidades`.
- `drizzle/0037_crm_followup.sql` gerada À MÃO (colunas aditivas com IF NOT EXISTS); seed da etapa vive no script `scripts/aplicar-migration-0037.ts` (transação, confere information_schema e existência da etapa antes — re-rodar é seguro). **NÃO aplicada — o usuário aplica com `npx tsx --env-file=.env.local scripts/aplicar-migration-0037.ts`.**

### Task 2 — Dados + actions
- `OportunidadeCard` ganhou `followupNivel`, `ultimoFollowupEm`, `temperatura`, `pendenciaFollowup`; query sequencial SEPARADA em try/catch (Map vazio + console.error se a 0037 estiver pendente); base dos 24h = `primeiro_contato_em` com fallback `createdAt`.
- `moverOportunidade`: mover para a etapa Follow-up seta D1 (`followup_nivel = 1` só se null — idempotente, não rebaixa) em try/catch próprio.
- Nova action `avancarFollowup(id)`: guarda sessão/workspace, recusa fechado/etapa errada/nível null/≥6; incrementa nível + carimbo + atividade tipo 'followup' (D{n}→D{n+1}).

### Task 3 — UI
- Card: chip 🔥 (âmbar pastel) / 🧊 (azul pastel) com variantes `dark:` ao lado do #N; selo "⏰ Follow-up pendente" (âmbar) e "Follow-ups esgotados" (vermelho + `ring-1 ring-red-500/40 dark:ring-red-400/40`); precedência SLA 1º contato > follow-up > semContato.
- `kanban-followup.tsx`: 7 colunas fixas D1..D6 (cabeçalho "D1 · 48h"…"D6 · final" derivado dos PRAZOS) + Perdido (coluna virtual fixa); drag apenas adjacente à frente → `avancarFollowup` otimista com rollback; soltar em Perdido reusa `MotivoPerdaDialog`/`moverParaPerdido`; estado vazio honesto quando a etapa não existe (migration pendente).
- `crm-view.tsx`: aba "Follow-up" (ícone Repeat2) com pausa de polling durante drag.

## Verificação

- `npx tsc --noEmit` limpo.
- `npx vitest run src/lib/crm src/lib/tarefas` — 1136 testes verdes (24 novos de followup/temperatura).
- ESLint limpo nos arquivos alterados.
- Sem a migration: /crm segue funcionando (sem nível/pendência, aba Follow-up com estado vazio honesto; temperatura já funciona pois é derivada).
- NÃO houve push para master (decisão do usuário: testar local primeiro).

## Deviations from Plan

None — plano executado exatamente como escrito.

## Pendências para o usuário

1. Aplicar a migration: `npx tsx --env-file=.env.local scripts/aplicar-migration-0037.ts` (cria as colunas E a etapa "Follow-up" na ordem 2 do pipeline Vendas).
2. Testar localmente e dar o OK antes de qualquer push para master.

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 (RED) | 916d73b | testes falhando de follow-up e temperatura |
| 1 (GREEN) | 2e03072 | regras puras + schema + migration 0037 + script |
| 2 | b16ffac | dados do card + entrada D1 + avancarFollowup |
| 3 | 8e3044e | chip temperatura, selos de pendência, aba Follow-up |

## Self-Check: PASSED
