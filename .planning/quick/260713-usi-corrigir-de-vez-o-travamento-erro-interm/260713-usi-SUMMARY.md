---
phase: quick-260713-usi
plan: 01
subsystem: financeiro
tags: [estabilidade, loading, retry, cold-start, supabase-pooler]
requires:
  - src/lib/utils/with-timeout.ts (withTimeout/TimeoutError, do fix 5b9cc46)
  - src/components/ui/skeleton.tsx (Skeleton do shadcn)
provides:
  - src/lib/utils/with-retry.ts (helper reutilizável de retry com teto por tentativa)
  - loading.tsx instantâneo para /financeiro e genérico para o grupo (app)
  - carga do financeiro em 2 lotes sequenciais com retry automático
affects:
  - Todas as rotas do grupo (app) — passam a mostrar skeleton na navegação
  - /financeiro — tela de erro vira último recurso (só após 2 tentativas)
tech-stack:
  added: []
  patterns:
    - "withRetry(factory, { timeoutMs, retryTimeoutMs, delayMs, label }) — o F5 automático server-side"
    - "Carga pesada em lotes sequenciais de 4 para respeitar pool max=3"
    - "loading.tsx espelhando o layout real para não haver pulo visual"
key-files:
  created:
    - src/app/(app)/financeiro/loading.tsx
    - src/app/(app)/loading.tsx
    - src/lib/utils/with-retry.ts
  modified:
    - src/app/(app)/financeiro/page.tsx
decisions:
  - "withRetry recebe factory (() => Promise<T>), não Promise pronta — cada tentativa redispara as queries do zero"
  - "carregarDados retorna tupla `as const` para manter o destructuring a jusante idêntico (menor diff)"
  - "Tetos: 12s na 1ª tentativa (falha rápido) e 15s no retry (conexões já quentes)"
metrics:
  duration: ~15min
  completed: 2026-07-14
---

# Quick 260713-usi: Corrigir de vez o travamento/erro intermitente do Financeiro Summary

Navegação instantânea com skeleton (loading.tsx), retry automático server-side (withRetry, o "F5 automático") e carga do /financeiro em 2 lotes sequenciais de 4 queries — a tela "Financeiro indisponível" vira último recurso.

## Tarefas Executadas

| # | Tarefa | Commit | Arquivos |
|---|--------|--------|----------|
| 1 | loading.tsx com skeleton (/financeiro + genérico do grupo) | b91134f | src/app/(app)/financeiro/loading.tsx, src/app/(app)/loading.tsx |
| 2 | Helper reutilizável withRetry | 493bd01 | src/lib/utils/with-retry.ts |
| 3 | Carga em 2 lotes sequenciais + retry na page do financeiro | 9a5282b | src/app/(app)/financeiro/page.tsx |

## O que mudou

1. **Skeleton instantâneo:** `src/app/(app)/financeiro/loading.tsx` espelha o layout real (cabeçalho + seletor de mês, grid de 6 KPIs, bloco do formulário, abas + tabela) — a navegação nunca mais "congela" esperando o servidor. `src/app/(app)/loading.tsx` genérico e leve beneficia todas as outras rotas do grupo (app); o específico do financeiro tem precedência.
2. **Retry automático:** `withRetry` executa a carga com teto de 12s; se falhar (TimeoutError ou soluço do pooler), espera 500ms e tenta UMA vez mais com teto de 15s — a 2ª tentativa reaproveita as conexões quentes do pool, exatamente por que o F5 manual sempre resolvia. Reusa `withTimeout` (não duplica lógica).
3. **2 lotes de 4:** com pool `max: 3`, disparar 8 queries de uma vez forçava 2 conexões frias extras no pico do cold start; os lotes sequenciais achatam esse pico sem reescrever nenhuma action.

Caminho de sucesso: JSX e nomes de variáveis 100% inalterados (zero mudança visual/funcional).

## Verificação

- `npx tsc --noEmit` — passou (Tarefas 1 e 2)
- `npm run build` — passou (Tarefa 3)
- Sem `Promise.all` único de 8 itens; `withRetry` no lugar do `withTimeout` direto na page
- `src/lib/db/index.ts` e `src/actions/financeiro.ts` intocados (verificado via `git diff HEAD~3 --stat`)
- Todos os textos e comentários novos em português

## Desvios do Plano

### Ajustes de contexto (não são mudanças de código do plano)

**1. [Rule 3 - Bloqueio] Worktree desatualizado em relação ao master**
- **Encontrado durante:** carregamento do plano
- **Problema:** o worktree de execução estava em d0d1502, atrás do master (0e9e705) — faltava o commit 5b9cc46 que criou `with-timeout.ts` e o bloco `withTimeout`/aquecimento que o plano refatora
- **Correção:** `git merge --ff-only master` (fast-forward seguro, HEAD era ancestral estrito — conforme protocolo do risco OneDrive/multi-sessão)
- **Arquivos modificados:** nenhum (só avanço de ponteiro)

**2. [Rule 3 - Bloqueio] PLAN.md não existia no worktree**
- **Problema:** o plano foi criado no checkout principal (untracked) e não aparecia no worktree
- **Correção:** copiado para `.planning/quick/260713-usi-corrigir-de-vez-o-travamento-erro-interm/` no worktree e commitado junto com este summary

Fora isso: nenhum — o plano foi executado exatamente como escrito.

## Known Stubs

Nenhum — nada de placeholder/mock foi introduzido.

## Self-Check: PASSED

- FOUND: src/app/(app)/financeiro/loading.tsx
- FOUND: src/app/(app)/loading.tsx
- FOUND: src/lib/utils/with-retry.ts
- FOUND: commit b91134f
- FOUND: commit 493bd01
- FOUND: commit 9a5282b
