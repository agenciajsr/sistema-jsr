---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 03
subsystem: auth
tags: [supabase-auth, ssr, nextjs-proxy, server-actions, react-hook-form, zod, drizzle-orm]

# Dependency graph
requires:
  - phase: 01-01
    provides: Projeto Next.js 16 escaonfolded, dependências instaladas, shadcn/ui configurado (Button, Card, Input, Label, Form)
  - phase: 01-02
    provides: Schema Drizzle (profiles/clientes/contratos) aplicado no Postgres real do Supabase, cliente Drizzle de runtime em src/lib/db
provides:
  - "Trio de clientes Supabase SSR (browser/server/proxy) seguindo o padrão @supabase/ssr do Next.js 16"
  - "proxy.ts (raiz, NÃO middleware.ts) protegendo todas as rotas exceto /login, revalidando sessão via getUser() a cada requisição"
  - "Server Actions signIn/signOut (src/actions/auth.ts) com copy exata do UI-SPEC"
  - "Página de login (React Hook Form + Zod) com rótulos Email/Senha e botão Entrar"
  - "Layout protegido (app)/layout.tsx com defesa em profundidade (getUser()) e logout"
  - "Helper de papel getCurrentUser()/requireAdmin() (src/lib/auth/session.ts) para autorização Admin/Membro em código de aplicação"
  - "scripts/seed-admin.ts + npm run seed:admin — primeiro usuário Admin bootstrapado com sucesso no Supabase real"
affects: ["01-04", "01-05", "01-06", "fase-2-integracao-ads", "fase-3-painel-trafego", "fase-4-financeiro-mrr", "fase-5-relatorios", "fase-6-painel-geral"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "proxy.ts na raiz (não middleware.ts) é obrigatório no Next.js 16.2 — middleware.ts é silenciosamente ignorado no build sem erro/aviso"
    - "Autorização Admin/Membro feita em código de aplicação (getCurrentUser/requireAdmin), não via Postgres RLS — conexão Drizzle usa role postgres que ignora RLS"
    - "tsx não carrega .env.local automaticamente — scripts standalone precisam de `tsx --env-file=.env.local`"
    - "Server Actions retornam { error: string } para exibição client-side; sucesso usa redirect() do next/navigation"
    - "Formulários client usam React Hook Form + Zod para validação local, com submissão via startTransition chamando a Server Action diretamente (sem useActionState) para manter estado de erro simples"

key-files:
  created:
    - proxy.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/proxy.ts
    - src/actions/auth.ts
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(app)/layout.tsx"
    - src/lib/auth/session.ts
    - scripts/seed-admin.ts
  modified:
    - package.json

key-decisions:
  - "Script seed-admin.ts invocado via `tsx --env-file=.env.local` em vez de apenas `tsx`, pois tsx (diferente do Next.js) não carrega .env.local automaticamente"
  - "Login page usa React Hook Form com submissão manual via useTransition + FormData chamando a Server Action, em vez de useActionState/form action direto, para permitir validação client-side (Zod) antes do round-trip ao servidor"

patterns-established:
  - "Toda rota autenticada usa dupla camada de proteção: proxy.ts (nível de requisição) + getUser() no layout do grupo de rotas (defesa em profundidade)"
  - "Server Actions de auth ficam centralizadas em src/actions/auth.ts — futuras Server Actions de domínio (clientes/contratos) devem seguir o mesmo padrão de retorno { error } / redirect()"

requirements-completed: [ACES-01, ACES-02, ACES-03]

# Metrics
duration: 29min
completed: 2026-07-10
---

# Phase 01 Plan 03: Autenticação Supabase Auth SSR Summary

**Login funcional via Supabase Auth SSR (trio de clientes + proxy.ts obrigatório do Next.js 16), Server Actions signIn/signOut, helper de papel Admin/Membro em código de aplicação, e primeiro usuário Admin bootstrapado com sucesso no Supabase real.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-07-10T22:30:30Z (aprox., após conclusão de 01-02)
- **Completed:** 2026-07-10T22:59:18Z
- **Tasks:** 3
- **Files modified:** 10 (9 criados, 1 modificado)

## Accomplishments
- Trio de clientes Supabase SSR (`src/lib/supabase/{client,server,proxy}.ts`) seguindo exatamente os padrões do 01-RESEARCH.md (Pattern 1/2)
- `proxy.ts` na raiz do projeto (não `middleware.ts` — Pitfall 1 crítico do Next.js 16.2) protegendo todas as rotas exceto `/login`, revalidando sessão via `supabase.auth.getUser()` (nunca `getSession()`)
- Página de login com React Hook Form + Zod, rótulos "Email"/"Senha" e botão "Entrar" (copy exata do UI-SPEC), exibindo a mensagem de erro "Não foi possível entrar. Verifique seu email e senha e tente novamente."
- Server Actions `signIn`/`signOut` em `src/actions/auth.ts` usando `signInWithPassword`/`signOut` do Supabase
- Layout protegido `(app)/layout.tsx` com defesa em profundidade (`getUser()`) e botão de logout
- Helper `getCurrentUser()`/`requireAdmin()` reutilizável para as fases seguintes autorizarem ações por papel
- `scripts/seed-admin.ts` executado com sucesso: primeiro Admin criado em Supabase Auth (`jsragencia@gmail.com`, id `ebdd5837-b3bc-4a9a-af1f-25ab1ef35fbd`) e linha correspondente em `profiles` com `role = 'admin'`, confirmado via query direta no Postgres

## Task Commits

Each task was committed atomically:

1. **Task 1: Trio de clientes Supabase SSR + proxy.ts** - `f9f91f5` (feat)
2. **Task 2: Página de login + Server Actions de autenticação + layout protegido** - `7b2e8ce` (feat)
3. **Task 3: Helper de papel (Admin/Membro) + script de bootstrap do primeiro Admin** - `6932ff0` (feat)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `proxy.ts` - Arquivo raiz obrigatório (Next.js 16), delega para `updateSession()`
- `src/lib/supabase/client.ts` - Cliente Supabase para Client Components (`createBrowserClient`)
- `src/lib/supabase/server.ts` - Cliente Supabase para Server Components/Actions (`cookies()` assíncrono)
- `src/lib/supabase/proxy.ts` - `updateSession()`: refresh de sessão + redirect para `/login` se não autenticado
- `src/actions/auth.ts` - Server Actions `signIn`/`signOut`
- `src/app/(auth)/login/page.tsx` - Formulário de login (RHF + Zod)
- `src/app/(app)/layout.tsx` - Layout da área autenticada com verificação de sessão e logout
- `src/lib/auth/session.ts` - `getCurrentUser()`/`requireAdmin()`
- `scripts/seed-admin.ts` - Script one-off de bootstrap do primeiro Admin
- `package.json` - Adicionado script `seed:admin`

## Decisions Made
- **`tsx --env-file=.env.local`** em vez de apenas `tsx` no script `seed:admin`, pois `tsx`/Node não carregam `.env.local` automaticamente como o Next.js faz (diferente de `next dev`/`next build`) — sem isso o script falhava com `supabaseUrl is required`.
- **Login via React Hook Form + `useTransition`** chamando a Server Action manualmente (em vez de `useActionState`/`<form action={signIn}>` direto), permitindo validação client-side com Zod antes do round-trip ao servidor, mantendo a Server Action (`signIn`) reutilizável independente de como é invocada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` não existia no worktree**
- **Found during:** Task 2 (antes de rodar `npm run build`)
- **Issue:** O worktree não tinha dependências instaladas (mesma situação documentada no plano 01-02 para este ambiente de worktrees paralelos)
- **Fix:** Executado `npm install` na raiz do worktree
- **Files modified:** nenhum arquivo versionado (apenas `node_modules/`, já ignorado)
- **Verification:** `npm run build` passou a executar com sucesso
- **Committed in:** N/A (não gera diff versionável)

**2. [Rule 3 - Blocking] `.env.local` não existia no worktree**
- **Found during:** Início da execução (antes do Task 1)
- **Issue:** `.env.local` é gitignored e não é compartilhado automaticamente entre o worktree principal e o worktree paralelo deste agente
- **Fix:** Copiado o conteúdo real de `.env.local` do repositório principal (já preenchido com credenciais do Supabase no plano 01-02) para o `.env.local` deste worktree
- **Files modified:** `.env.local` (não versionado, intencionalmente fora do controle de versão)
- **Verification:** `npm run build` e `npm run seed:admin` conseguiram ler as variáveis de ambiente
- **Committed in:** N/A (`.env.local` nunca é versionado)

**3. [Rule 3 - Blocking] `tsx` não carrega `.env.local` automaticamente**
- **Found during:** Task 3 (primeira tentativa de `npm run seed:admin`)
- **Issue:** `npm run seed:admin` falhava com `Error: supabaseUrl is required.` — `tsx scripts/seed-admin.ts` não injeta variáveis de `.env.local` como o Next.js faz nativamente
- **Fix:** Alterado o script em `package.json` para `tsx --env-file=.env.local scripts/seed-admin.ts` (flag nativa do Node 20.6+/tsx)
- **Files modified:** `package.json`
- **Verification:** `npm run seed:admin` executou com sucesso, criando o usuário Admin e a linha em `profiles`
- **Committed in:** `6932ff0` (parte do commit da Task 3)

---

**Total deviations:** 3 auto-fixed (todos Rule 3 - Blocking)
**Impact on plan:** Todos os auto-fixes foram necessários para completar a execução real (build + bootstrap do Admin) neste worktree paralelo. Nenhum foi scope creep — nenhuma mudança de arquitetura ou funcionalidade além do especificado no plano.

## Issues Encountered
None além dos blockers documentados acima em Deviations, todos resolvidos.

## User Setup Required

None - nenhuma configuração adicional de serviço externo requerida. `.env.local` já estava preenchido com credenciais reais do Supabase (herdadas do plano 01-02); o primeiro Admin já foi criado neste plano.

## Next Phase Readiness

- Autenticação completa e funcional: login, proteção de rotas (proxy.ts + defesa em profundidade no layout), sessão persistente via cookies do Supabase Auth, helper de papel Admin/Membro pronto para uso pelas Server Actions de clientes/contratos (planos 01-04/01-05)
- Primeiro Admin bootstrapado no Supabase real (`jsragencia@gmail.com`) — pode ser usado para testar o fluxo de login manualmente e para futuras Server Actions `requireAdmin()`-protegidas
- Nenhum bloqueio conhecido para os planos seguintes da Fase 1
- Verificação end-to-end completa do fluxo de login (clique real no navegador) fica para o checkpoint final do plano 01-09, conforme especificado neste plano

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 9 key files confirmed present on disk. All 3 task commits (`f9f91f5`, `7b2e8ce`, `6932ff0`) confirmed in git log.
