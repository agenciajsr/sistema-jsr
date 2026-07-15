---
phase: quick-260715-oz9
plan: 01
subsystem: infra/resiliencia
tags: [auth, pool, error-boundary, supavisor, retry]
requires: []
provides:
  - "getCurrentUser com retry (5s → 8s) na revalidação de sessão"
  - "Error boundary de raiz em português (src/app/error.tsx)"
  - "Pool postgres.js com max=5 e delay de 3s no retry do /financeiro"
affects: [todas as páginas logadas, /financeiro]
tech-stack:
  added: []
  patterns:
    - "withRetry como padrão para operações críticas contra o pooler (agora também na sessão)"
key-files:
  created:
    - src/app/error.tsx
  modified:
    - src/lib/auth/session.ts
    - src/lib/db/index.ts
    - src/app/(app)/financeiro/page.tsx
key-decisions:
  - "Sessão inteira (auth.getUser + profiles.findFirst) numa única factory com withRetry; deslogado/sem profile retorna null sem gastar retry"
  - "Sem global-error.tsx — root layout é estático e praticamente não falha em runtime (registrado em comentário no error.tsx de raiz)"
  - "max: 5 no pool (era 3); statement_timeout: 12s e max_pipeline: 1 intocados"
  - "delayMs: 3000 no withRetry do /financeiro para queries órfãs liberarem o pool antes da 2ª tentativa"
duration: 12min
completed: 2026-07-15
---

# Quick 260715-oz9: Corrigir cascata de travamento (retry na sessão) Summary

Retry 5s→8s em getCurrentUser, error boundary de raiz em português e pool max=5 + delay de 3s no retry do /financeiro — quebra a cascata financeiro → todas as páginas vista em produção em 15/jul/2026.

## O que foi feito

### Task 1 — Retry na validação de sessão (e7202ff)
- `src/lib/auth/session.ts`: os dois `withTimeout` diretos viraram UMA chamada `withRetry(revalidarSessao, { timeoutMs: 5_000, retryTimeoutMs: 8_000, label: 'sessao' })`.
- Factory `revalidarSessao` faz auth.getUser + profiles.findFirst juntos; curto-circuito de deslogado/sem profile retorna `null` sem gastar retry.
- Lança SÓ após 2 falhas (erro sobe para o error boundary). `cache()` e comentários preservados/atualizados com o histórico da cascata.

### Task 2 — Error boundary de raiz (4f9a4b9)
- `src/app/error.tsx` criado (client component, português): captura erros do layout do grupo `(app)`, que o `src/app/(app)/error.tsx` NÃO captura (regra do App Router).
- Botão nativo estilizado com tokens do design system (`bg-primary text-primary-foreground`) + lucide — zero dependência do grupo (app).
- Decisão de NÃO criar `global-error.tsx` registrada em comentário.

### Task 3 — Pool com folga + retry do financeiro menos agressivo (4c3ee4a)
- `src/lib/db/index.ts`: `max: 3` → `max: 5`, comentário rico atualizado preservando todo o histórico (max_pipeline: 1 e statement_timeout: 12s intocados).
- `src/app/(app)/financeiro/page.tsx`: `delayMs: 3_000` no withRetry + comentários da "Estratégia anti-travamento" atualizados; 2 lotes sequenciais mantidos.

## Verificação
- `npx tsc --noEmit` verde nas 3 tasks.
- `npm test`: 1463 testes passando (111 arquivos).
- `npm run build` verde (valida error.tsx de raiz e páginas server).
- Smoke manual pós-deploy pendente do usuário: abrir /financeiro e navegar — nenhuma tela preta em inglês.

## Deviations from Plan

None - plan executed exactly as written. (Único ajuste menor: comentário do "lote 1" no financeiro mencionava "pool max=3" e foi atualizado para refletir max=5 — parte natural da Task 3.)

## Commits
- e7202ff — fix(quick-260715-oz9): retry na validação de sessão (getCurrentUser)
- 4f9a4b9 — feat(quick-260715-oz9): error boundary de raiz em português (src/app/error.tsx)
- 4c3ee4a — fix(quick-260715-oz9): pool max 3→5 + retry do financeiro com delay de 3s

## Known Stubs

Nenhum.

## Self-Check: PASSED
- src/app/error.tsx existe; src/lib/auth/session.ts usa withRetry; src/lib/db/index.ts com max: 5.
- Commits e7202ff, 4f9a4b9, 4c3ee4a presentes no git log.
