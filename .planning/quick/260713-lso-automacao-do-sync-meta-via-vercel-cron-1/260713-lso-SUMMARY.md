---
phase: quick-260713-lso
plan: 01
subsystem: integracao-meta
tags: [meta-ads, cron, vercel, sync]
requires:
  - src/lib/meta/sync.ts (sincronizarContasMeta existente)
  - src/lib/meta/client.ts (fetchMetaAdAccounts)
provides:
  - atualizarListaContasMeta()
  - sincronizarTudoMeta()
  - rota GET /api/cron/sync-meta
  - agendamento Vercel Cron diario
affects:
  - vercel.json (novo)
tech-stack:
  added: []
  patterns:
    - Vercel Cron (GET route handler) protegido por CRON_SECRET Bearer
key-files:
  created:
    - src/app/api/cron/sync-meta/route.ts
    - vercel.json
  modified:
    - src/lib/meta/sync.ts
decisions:
  - Cron diario 09:00 UTC (06:00 Brasilia) — limite do plano Hobby (1 cron/dia)
  - Funcao Inngest e botao manual preservados; cron Inngest permanece inativo em producao
metrics:
  duration: ~12min
  completed: 2026-07-13
---

# Phase quick-260713-lso Plan 01: Automacao do Sync Meta via Vercel Cron Summary

Sync da Meta Ads passa a rodar automaticamente 1x/dia em producao via Vercel Cron, sem depender do botao manual, com descoberta de contas centralizada em `sync.ts` e rota GET protegida por `CRON_SECRET`.

## O Que Foi Feito

- **Task 1 — `src/lib/meta/sync.ts`:** adicionadas duas funcoes exportadas (nada removido):
  - `atualizarListaContasMeta(): Promise<number>` — chama `fetchMetaAdAccounts()` e faz upsert em `adAccounts` (remove prefixo `act_`, SELECT por `metaAccountId`, UPDATE ou INSERT). Espelha exatamente o passo `sync-ad-accounts` da funcao Inngest, agora reutilizavel.
  - `sincronizarTudoMeta(): Promise<{ contas; insights }>` — orquestrador: descobre/atualiza contas ANTES de `sincronizarContasMeta(null)`, reaproveitando a logica de insights existente (sem duplicar).
  - Import de `fetchMetaAdAccounts` adicionado ao import ja existente de `@/lib/meta/client`.
- **Task 2 — `src/app/api/cron/sync-meta/route.ts` (novo):** Route Handler `GET` com `runtime = 'nodejs'` e `maxDuration = 300`. Se `CRON_SECRET` setado, exige header `Authorization: Bearer ${secret}` (401 se nao bater); se ausente, `console.warn` e permite execucao. Sem `getCurrentUser`. Chama `sincronizarTudoMeta()` em try/catch, retornando JSON (`{ ok, contas, insights }` ou erro 500).
- **Task 3 — `vercel.json` (novo, raiz):** `crons: [{ path: '/api/cron/sync-meta', schedule: '0 9 * * *' }]`. Sem campo `regions` (gru1 fica no painel da Vercel).

## Verificacao

- `npm run build` — passou; rota `f /api/cron/sync-meta` registrada no output.
- `npx tsc --noEmit` — 0 erros.
- `npx vitest run` — 67/67 testes passando (7 arquivos).
- Funcao Inngest (`sync-meta-ads.ts`) e botao manual (`POST /api/sync-meta`) INALTERADOS.

## Deviations from Plan

**Ajuste operacional (nao de escopo):** o worktree de execucao (`worktree-agent-abc13b809ec507034`) estava 16 commits atras de `master` e nao continha `src/lib/meta/sync.ts` nem a integracao Meta. Como o worktree era ancestral limpo de master (sem commits divergentes), foi feito fast-forward (`git merge --ff-only master`) para trazer o codigo atual antes de executar. Nenhuma alteracao de codigo do plano foi afetada; apenas alinhamento da base.

Fora isso: plano executado exatamente como escrito. Nenhuma mudanca de schema/migration.

## Known Stubs

Nenhum. Toda a logica esta ligada a dados/funcoes reais.

## Notas Operacionais

- Para ativar a protecao, definir a env var `CRON_SECRET` no painel da Vercel. O Vercel Cron envia automaticamente o header `Authorization: Bearer ${CRON_SECRET}` quando a variavel existe no projeto.
- Deploy do cron acontece no `git push origin master` (Vercel deploya de producao da branch master).

## Self-Check: PASSED
- FOUND: src/lib/meta/sync.ts (atualizarListaContasMeta, sincronizarTudoMeta)
- FOUND: src/app/api/cron/sync-meta/route.ts
- FOUND: vercel.json
- FOUND commits: bd20aa0, a0e7c33, 5475566
