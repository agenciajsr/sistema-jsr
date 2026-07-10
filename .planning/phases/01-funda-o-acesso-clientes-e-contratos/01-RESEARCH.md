# Phase 1: Fundação — Acesso, Clientes e Contratos - Research

**Researched:** 2026-07-10
**Domain:** Next.js 16 App Router + Supabase Auth (SSR) + Drizzle ORM + Postgres — greenfield project scaffolding, multi-user auth, relational CRUD with history
**Confidence:** HIGH (stack setup, auth pattern, connection pooling) / MEDIUM (exact env var naming during 2026 API key migration, admin-user-creation UX choice)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Papéis e Permissões**
- D-01: Dois papéis: Admin e Membro (não é acesso único/flat).
- D-02: Apenas Admin pode criar novos usuários da equipe. Sem auto-cadastro aberto e sem fluxo de convite por email nesta fase (isso adiaria a fase por depender de envio de email — Resend é opcional/adiado no stack recomendado).
- D-03: Admin e Membro podem ambos criar/editar clientes e contratos. Exclusão de clientes/contratos é exclusiva do Admin (evita perda acidental de dados).

**Modelo de Dados: Cliente**
- D-04: Cliente tem um campo de status explícito e manual: ativo, pausado, encerrado. Não é inferido automaticamente pela vigência do contrato.
- D-05: Campos do cliente nesta fase: nome, nicho/objetivo (e-commerce, negócio local, infoproduto), status (ativo/pausado/encerrado), contato responsável (nome + telefone/email), notas/observações livres (texto).

**Modelo de Dados: Contrato**
- D-06: Contratos têm histórico — cada renovação cria um novo registro de contrato vinculado ao cliente, mantendo os anteriores. A UI deve sempre deixar claro qual é o contrato atual/vigente vs. histórico.
- D-07: O valor do contrato é sempre uma mensalidade recorrente (MRR) — não existe contrato de valor único/pontual nesta fase.
- D-08: Campos do contrato: data de início, data de vencimento/renovação, valor mensal.

**Lista de Clientes (UI)**
- D-09: Layout em cards (um card por cliente), não tabela.
- D-10: Cada card mostra: status do cliente (badge visual), nicho/objetivo, valor do contrato atual (MRR), vigência do contrato (dias até vencer / data de vencimento).

### Claude's Discretion
- Fluxo exato de login (formulário, mensagens de erro, redirecionamentos) — usar padrões do Supabase Auth.
- Duração exata da sessão / comportamento de "permanecer logado" — usar o comportamento padrão do Supabase Auth (sessão persistente via cookie), sem exigir configuração adicional nesta fase.
- Layout exato do card (hierarquia visual, cores por status) — seguir padrões de shadcn/ui.
- Validações de formulário (obrigatoriedade de campos, formatos) para os campos de contato/notas — usar bom senso, campos de contato podem ser opcionais.
- Estrutura de tabelas no banco (nomes de colunas, tipos) — Drizzle ORM + Postgres conforme stack do projeto.

### Deferred Ideas (OUT OF SCOPE)
- Fluxo de convite por email para novos usuários (ficou fora — só Admin cria usuário diretamente por enquanto). Pode ser revisitado se o time crescer e o cadastro manual virar fricção.
- Provisionamento de usuários não foi aprofundado além de "só Admin cria" — se surgir necessidade de autoatendimento (ex: recuperação de senha, troca de email), tratar em fase futura ou ajuste posterior.

None além disso — discussão ficou dentro do escopo da fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACES-01 | Login com email e senha | Supabase Auth `signInWithPassword` via Server Action + `@supabase/ssr` server client. See Architecture Patterns → Auth Setup. |
| ACES-02 | Múltiplos usuários internos da JSR | `profiles` table extending `auth.users` with a `role` enum (admin/membro); users provisioned by Admin (Admin API `auth.admin.createUser`), not self-signup. See Standard Stack + Don't Hand-Roll. |
| ACES-03 | Sessão permanece ativa entre acessos | Supabase Auth default cookie-based session (access + refresh token), kept alive via `proxy.ts` (Next.js 16 rename of `middleware.ts`) calling `supabase.auth.getUser()` on every request. See Common Pitfalls → Pitfall 1. |
| CLI-01 | Cadastrar cliente (nome, nicho) | Drizzle `clientes` table + Zod schema + React Hook Form. See Architecture Patterns → Data Model. |
| CLI-02 | Registrar contrato (início, vencimento, valor) | Drizzle `contratos` table, FK to `clientes`, `numeric` for money. See Architecture Patterns → Contract History Pattern. |
| CLI-03 | Editar cliente e contrato | Server Actions with Zod validation; edit contract = insert new row (history), not update in place, per D-06. |
| CLI-04 | Lista de clientes ativos com status resumido | Query joining `clientes` + "current contract" (derived, not flagged) + card UI (shadcn/ui). See Architecture Patterns → Current Contract Derivation. |
</phase_requirements>

## Summary

This is a greenfield Next.js 16.2 project with no code yet. The phase must produce: (1) initial app scaffolding, (2) Supabase project wiring (Auth + Postgres), (3) Drizzle schema for `profiles`/`clientes`/`contratos` with a contract-history pattern, (4) a way to bootstrap the very first Admin user in a system with no self-signup, and (5) protected routes + a card-based client list UI.

The single highest-risk item for this exact stack combination is **Next.js 16's `middleware.ts` → `proxy.ts` rename**: nearly all Supabase Auth SSR documentation and AI-assisted scaffolds (including Supabase's own official docs, correct as of this writing) still show `middleware.ts` with an exported `middleware()` function. On Next.js 16.2 (the version this project uses), a file named `middleware.ts` is **silently ignored at build time — no error, no warning** — meaning session refresh and route protection would appear to "work" in a quick manual test (because client-side Supabase calls still function) but would leave protected routes reachable without a valid session on direct navigation/refresh, and session cookies would eventually go stale. The plan MUST use `proxy.ts` with an exported `proxy()` function, `nodejs` runtime (the only option — Edge Runtime is not supported here in v16).

The second key decision the plan needs to make explicitly is the **contract history model**: rather than adding an `is_current` boolean flag on `contratos` (which can drift out of sync when two rows are marked current, or a renewal is edited/deleted), derive the "current" contract per client as the row with the latest `data_inicio` (a plain query, no extra state to keep consistent) — a standard Type-2 slowly-changing-dimension pattern.

The third decision is **authorization model**: because Drizzle will connect to Postgres directly via a service/pooled connection string (not through Supabase's PostgREST layer), that connection runs as the `postgres` role, which **bypasses Row-Level Security by default**. For a ~10-client, ~5-person internal tool, the pragmatic and standard approach (used by most Next.js+Drizzle+Supabase-Auth stacks) is to skip RLS entirely for now and enforce Admin/Membro authorization in application code (Server Actions check `role` from the session before mutating/deleting) — not to build a parallel RLS policy layer that Drizzle's own connection would ignore anyway unless deliberately wired through Supabase's JWT-scoped client. This should be stated as a decision, not left implicit.

**Primary recommendation:** Scaffold with `create-next-app` (App Router, TS, Tailwind) → wire `@supabase/ssr` using `proxy.ts` (not `middleware.ts`) → define Drizzle schema (`profiles`, `clientes`, `contratos`) with `pgEnum` for role/nicho/status and `numeric` for money → connect Drizzle via Supabase's pooled (transaction-mode, port 6543) connection string with `{ prepare: false }` for runtime, and the direct/session connection (port 5432) for `drizzle-kit` migrations → bootstrap the first Admin via a one-off Node script using the Supabase secret key and `auth.admin.createUser()` → enforce Admin/Membro checks in Server Actions, not RLS, for this phase.

## Project Constraints (from CLAUDE.md)

These directives are locked by the project's CLAUDE.md and override any alternative approach this research might otherwise suggest:

- Stack is fixed: Next.js 16.2.x (App Router), TypeScript 5.x, Supabase (Postgres + Auth), Drizzle ORM 0.45.x + drizzle-kit 0.31.x, Tailwind CSS 4.3.x + shadcn/ui, Zod 4.4.x, React Hook Form 7.81.x + `@hookform/resolvers` 5.4.x.
- Use the `postgres` (porsager) driver with Supabase's **pooled** connection (port 6543, transaction mode) for all runtime code (Server Actions, Route Handlers); use the **direct** connection (port 5432) only for running `drizzle-kit` migrations. Mixing these up is called out explicitly as "the #1 cause of 'too many connections' errors on serverless Postgres."
- Auth: use Supabase Auth (not next-auth/Auth.js — explicitly listed under "What NOT to Use" because it's still in beta after ~2 years).
- No email invite flow / Resend is optional and deferred — matches CONTEXT.md D-02 exactly, do not build one in this phase.
- Do not hand-roll a custom OAuth "connect your ad account" flow — not relevant to Phase 1, but confirms the project's general bias against custom auth machinery when a managed option exists.
- `GSD Workflow Enforcement`: all file-changing work must go through a GSD command (`/gsd:execute-phase`, etc.) — not a research constraint, but the planner should be aware plans will be executed under this rule.
- Communicate in Portuguese (from user memory) — the app's own UI copy, and any user-facing planning docs, should follow this; code/comments can remain in English per common convention unless the plan says otherwise (no explicit instruction found either way — flagging as an open question below is unnecessary since CLAUDE.md's own tables/decisions are already bilingual, code in English + UI strings in Portuguese is the safe default).

## Standard Stack

### Core
| Library | Version (verified via npm view, 2026-07-10) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.10 | Framework | Pinned by CLAUDE.md; current stable includes Turbopack-by-default and the `proxy.ts` rename (see pitfalls). |
| `@supabase/supabase-js` | 2.110.2 | Supabase client (used for Admin API calls, e.g. `auth.admin.createUser`) | Official client; required for any Auth Admin operations. |
| `@supabase/ssr` | 0.12.0 | Cookie-based SSR auth client for Next.js (browser/server/proxy variants) | Official replacement for the deprecated `@supabase/auth-helpers-nextjs`; only supported path for App Router + Supabase Auth as of 2026. |
| `drizzle-orm` | 0.45.2 | ORM / query builder | Pinned by CLAUDE.md. |
| `drizzle-kit` | 0.31.10 | Schema migrations, `drizzle-kit studio` | Pinned by CLAUDE.md. |
| `postgres` (porsager) | 3.4.9 | Postgres driver for Drizzle | Pinned by CLAUDE.md; required for `prepare: false` support against Supabase's transaction pooler. |
| `zod` | 4.4.3 | Runtime validation (forms, Server Action input) | Pinned by CLAUDE.md. |
| `react-hook-form` | 7.81.0 | Form state | Pinned by CLAUDE.md. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@hookform/resolvers` | 5.4.x (per CLAUDE.md) | Bridges Zod schemas to React Hook Form | Zod 4 has had reported type-inference friction with older `@hookform/resolvers` majors — CLAUDE.md's pinned 5.4.x line is confirmed compatible with Zod 4 by community reports as of March 2026; do not downgrade below the version that added Zod 4 support. |
| `date-fns` | 4.4.x (per CLAUDE.md) | Date math for contract vencimento countdowns (used on client cards, D-10) | Needed as soon as CLI-04's "dias até vencer" is implemented. |
| shadcn/ui `card`, `badge`, `form`, `dialog`, `input`, `select` components | — (CLI, not npm) | Card list (D-09), status badges (D-10), forms | Install via `npx shadcn@latest add <component>`; matches CLAUDE.md's UI stack, no separate table/grid component library needed for a card layout. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| App-level Admin/Membro authorization in Server Actions | Postgres Row-Level Security + Drizzle's `/supabase` role helpers (`drizzle-orm/supabase`) | RLS is more defense-in-depth (protects data even if a Server Action forgets a check) but requires either querying through Supabase's JWT-aware PostgREST layer or manually setting `request.jwt.claims` on the Drizzle connection per request — real added complexity for a ~5-person internal tool. Reasonable to defer; document as a v2 hardening option, not a Phase 1 requirement. |
| One-off Node script for first-Admin bootstrap | Supabase Dashboard manual user creation + manual SQL `UPDATE profiles SET role='admin'` | Manual dashboard approach requires zero code but isn't repeatable/scriptable for a second environment (staging) and isn't self-documenting. A script (`scripts/seed-admin.ts`) is closer to standard practice and costs little. |
| `is_current` boolean flag on `contratos` | Derived "current = latest `data_inicio`" query | A flag needs to be kept in sync (unset previous row's flag on every renewal) — an extra write and a source of bugs (two rows marked current). Derivation has no sync risk; only tradeoff is a slightly less trivial query (`ORDER BY data_inicio DESC LIMIT 1` per client), which is cheap at ~10 clients. |

**Installation:**
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
npm install @supabase/supabase-js @supabase/ssr drizzle-orm postgres zod react-hook-form @hookform/resolvers date-fns
npm install -D drizzle-kit
npx shadcn@latest init
```

**Version verification:** Verified 2026-07-10 via `npm view <package> version` (see table above) — no training-data staleness on these numbers, all confirmed against the live npm registry moments before writing this document. `next` 16.2.10, `@supabase/supabase-js` 2.110.2, `@supabase/ssr` 0.12.0, `drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10, `postgres` 3.4.9, `zod` 4.4.3, `react-hook-form` 7.81.0 — all match or exceed the versions CLAUDE.md pinned, confirming CLAUDE.md's stack table is current.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx           # Login form (Server Action calls signInWithPassword)
│   ├── (app)/                     # Route group for authenticated area
│   │   ├── layout.tsx             # Shared shell (nav, current-user display)
│   │   ├── clientes/
│   │   │   ├── page.tsx           # CLI-04: card list of clients
│   │   │   ├── novo/page.tsx      # CLI-01/02: create client + first contract
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Client detail
│   │   │       └── editar/page.tsx # CLI-03: edit client / register renewal
│   │   └── usuarios/              # OPEN QUESTION: only if Admin-creates-user gets a UI (see Open Questions)
│   └── layout.tsx                 # Root layout
├── proxy.ts                       # NOT middleware.ts — see Pitfall 1 (project root or src/, both valid in Next 16)
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient
│   │   ├── server.ts               # createServerClient (Server Components/Actions)
│   │   └── proxy.ts                # updateSession() helper used by proxy.ts
│   ├── db/
│   │   ├── index.ts                # Drizzle client (pooled connection, prepare:false)
│   │   └── schema.ts                # profiles, clientes, contratos tables + relations
│   └── validations/
│       ├── cliente.ts               # Zod schema for cliente form
│       └── contrato.ts              # Zod schema for contrato form
├── actions/                        # Server Actions (mutations), grouped by domain
│   ├── clientes.ts
│   ├── contratos.ts
│   └── auth.ts
scripts/
└── seed-admin.ts                   # One-off: bootstrap first Admin via auth.admin.createUser
drizzle/
└── (generated migration SQL files)
drizzle.config.ts                   # Points at DIRECT (5432) connection for migrations
```

This mirrors the `src/app` (routing only) + `src/lib` (server/client utilities) + Server Actions convention that is the current common pattern for Next.js App Router + Supabase + Drizzle projects (multiple 2026 community sources cross-verified — MEDIUM confidence on exact folder names, HIGH confidence on the routing/logic separation principle itself, which is also implied by Next.js's own "Project Structure" docs).

### Pattern 1: Supabase Auth SSR client trio (browser / server / proxy)
**What:** Three separate Supabase client constructors — one for Client Components (`createBrowserClient`), one for Server Components/Actions (`createServerClient` reading `cookies()`), and one used inside `proxy.ts` (reads/writes cookies on the request/response directly, not via `next/headers`).
**When to use:** Always, for any Supabase Auth SSR integration in App Router. This is the only supported pattern — do not use `@supabase/auth-helpers-nextjs` (deprecated) or a single shared client.
**Example (server client, Next.js 16 — `cookies()` is async):**
```typescript
// lib/supabase/server.ts — Source: Supabase official docs, Server-Side Auth for Next.js
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // MUST await — Next.js 16 removed sync access entirely

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // or ANON_KEY, see Pitfall 4
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore if proxy.ts refreshes sessions
          }
        },
      },
    }
  )
}
```

### Pattern 2: `proxy.ts` — Next.js 16's replacement for `middleware.ts`
**What:** The file that intercepts every matched request to refresh the Supabase session and redirect unauthenticated users. In Next.js 16 this file MUST be named `proxy.ts` (not `middleware.ts`) and export a function named `proxy` (not `middleware`).
**When to use:** Always, for session refresh + route protection with Supabase Auth SSR on Next.js 16.
**Example:**
```typescript
// proxy.ts — Source: Next.js 16 docs (middleware-to-proxy) + Supabase SSR docs, adapted
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getUser(), not getSession() — getUser() revalidates the token
  // against Supabase's Auth server; getSession() only reads the local cookie.
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```
Runtime is fixed to `nodejs` in `proxy.ts` (cannot be configured, unlike old Edge-Runtime middleware) — no action needed, just don't try to set `runtime: 'edge'`.

### Pattern 3: Drizzle schema — roles, clients, contract history
**What:** `profiles` extends `auth.users` (Supabase-managed, cannot add columns directly); `clientes` and `contratos` are plain app tables; `contratos` has no `is_current` flag — current contract is derived.
**When to use:** This phase's entire data model.
**Example:**
```typescript
// lib/db/schema.ts
import { pgTable, pgEnum, uuid, text, timestamp, date, numeric, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const roleEnum = pgEnum('role', ['admin', 'membro'])
export const nichoEnum = pgEnum('nicho', ['ecommerce', 'negocio_local', 'infoproduto'])
export const clienteStatusEnum = pgEnum('cliente_status', ['ativo', 'pausado', 'encerrado'])

// Extends Supabase-managed auth.users — do NOT redefine auth.users itself in Drizzle.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // == auth.users.id, set explicitly on insert, not defaultRandom()
  nome: text('nome').notNull(),
  role: roleEnum('role').notNull().default('membro'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const clientes = pgTable('clientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  nicho: nichoEnum('nicho').notNull(),
  status: clienteStatusEnum('status').notNull().default('ativo'),
  contatoNome: text('contato_nome'),
  contatoTelefone: text('contato_telefone'),
  contatoEmail: text('contato_email'),
  notas: text('notas'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contratos = pgTable('contratos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  dataInicio: date('data_inicio').notNull(),
  dataVencimento: date('data_vencimento').notNull(),
  valorMensal: numeric('valor_mensal', { precision: 10, scale: 2 }).notNull(), // NEVER use float/real for money
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: index('contratos_cliente_id_idx').on(table.clienteId, table.dataInicio),
}))

export const clientesRelations = relations(clientes, ({ many }) => ({
  contratos: many(contratos),
}))
export const contratosRelations = relations(contratos, ({ one }) => ({
  cliente: one(clientes, { fields: [contratos.clienteId], references: [clientes.id] }),
}))
```

**Current-contract derivation (query, not stored flag):**
```typescript
// "current" contrato per cliente = row with max(data_inicio)
import { desc, eq } from 'drizzle-orm'

const currentContrato = await db.query.contratos.findFirst({
  where: eq(contratos.clienteId, clienteId),
  orderBy: [desc(contratos.dataInicio)],
})
```
For CLI-04 (list of all clients with current contract), a single query per client is fine at ~10 clients; if it needs to be one query for the whole list, use Postgres `DISTINCT ON (cliente_id) ... ORDER BY cliente_id, data_inicio DESC` via Drizzle's `sql` helper, or a Postgres view — either is a reasonable planner choice, not a hard requirement.

### Anti-Patterns to Avoid
- **`is_current` boolean on `contratos`:** Requires an extra write on every renewal to unset the previous row, and can silently drift (two "current" rows, or zero). Use derived latest-by-`data_inicio` instead (see above).
- **Storing money as `real`/`float`/`double precision`:** Causes rounding errors in MRR sums (Phase 4 depends on this). Use `numeric(10,2)`.
- **Calling `supabase.auth.getSession()` inside `proxy.ts` or Server Components to gate access:** `getSession()` only reads the (possibly stale) local cookie and does not revalidate against Supabase's Auth server; use `getUser()` for anything that gates access to data, per Supabase's own current guidance.
- **Editing a `contrato` row in place for a renewal:** Violates D-06 (history requirement). "Edit" in the UI for a renewal must mean "insert a new `contratos` row"; only non-financial-history fields (e.g. fixing a typo in an existing contract's dates before it's superseded) should be a true `UPDATE`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Password hashing, session tokens, refresh-token rotation | Custom auth/JWT logic | Supabase Auth (`signInWithPassword`, `@supabase/ssr` cookie handling) | This is explicitly why CLAUDE.md rejects next-auth (still beta) in favor of Supabase Auth — a fully managed, stable option already covers the exact need (5-10 internal users, simple email/password). |
| Admin-only user provisioning | A custom "invite" table + token-based signup flow | `supabase.auth.admin.createUser()` (Admin API, requires the secret/service key, server-only) | D-02 explicitly defers invite-by-email; the Admin API already supports directly creating a user with a password and `email_confirm: true`, which is exactly "Admin creates account directly." |
| Contract renewal history / audit trail | A separate `contrato_historico` table synced by triggers | Append-only `contratos` table (D-06 already specifies this — every renewal is a new row) | An append-only table with a derived "current" query is simpler and has no synchronization surface, unlike a two-table original+history split. |
| Form validation duplication (client + server) | Hand-written validators in two places | One Zod schema per entity, imported by both the React Hook Form resolver (client) and the Server Action (server) | Standard Zod + RHF + Server Actions pattern; prevents the client and server from silently disagreeing on validation rules. |

**Key insight:** Nearly everything risky in this phase (auth, password storage, session refresh, admin user creation) has a first-party Supabase primitive. The only genuinely custom logic this phase needs to write is the data model (`clientes`/`contratos`) and the thin Server Action layer around it — keep it that way; resist adding custom auth or history-tracking machinery.

## Common Pitfalls

### Pitfall 1: `middleware.ts` is silently ignored on Next.js 16 — must be `proxy.ts`
**What goes wrong:** A developer follows Supabase's official Next.js Auth tutorial (which, as of this research, still documents `middleware.ts`) or an AI-generated scaffold trained on pre-Next.js-16 patterns. The file builds and runs with zero errors or warnings, but on Next.js 16.2 it is never invoked — no session refresh happens, and unauthenticated users can reach protected routes directly (ACES-03 and route protection silently break).
**Why it happens:** Next.js 16 renamed the file convention from `middleware` to `proxy` (`nodejs`-only runtime) but did not add a build-time error for a stray `middleware.ts` — it's just ignored.
**How to avoid:** Name the file `proxy.ts` (root or `src/`) and export `async function proxy(request: NextRequest)`, not `middleware`. Verify by testing: log out, hit a protected URL directly (not via client-side nav) — must redirect to `/login`.
**Warning signs:** Auth "seems to work" when clicking through the app (client-side session state masks the gap) but a hard refresh or direct URL on a protected page doesn't redirect when logged out.
**Confidence:** HIGH — directly verified against Next.js's own official docs (`nextjs.org/docs/messages/middleware-to-proxy`, `nextjs.org/docs/app/guides/upgrading/version-16`).

### Pitfall 2: Mixing pooled and direct Postgres connections
**What goes wrong:** Using the transaction-mode pooler (port 6543) for `drizzle-kit generate`/`migrate`, or using the direct connection (port 5432) at runtime in Server Actions.
**Why it happens:** Supabase exposes both connection strings side-by-side in its dashboard and it's easy to copy the wrong one into the wrong `.env` variable.
**How to avoid:** Use two separate connection strings/env vars: `DATABASE_URL` (pooled, port 6543, `{ prepare: false }`) for the app's Drizzle client at runtime; `DIRECT_URL` (port 5432) referenced only in `drizzle.config.ts` for migrations. Migrations against the pooler can fail or behave unexpectedly because transaction-mode pooling doesn't support all session-level Postgres features that `drizzle-kit` may need.
**Warning signs:** `too many connections` errors in production, or migration commands hanging/erroring against the pooled URL.
**Confidence:** HIGH — corroborated by CLAUDE.md itself, Drizzle's own official Supabase connection docs, and multiple independent 2026 sources.

### Pitfall 3: Prepared statements fail against the transaction pooler
**What goes wrong:** `postgres-js` (and therefore Drizzle) issues named prepared statements by default; Supabase's transaction-mode pooler (Supavisor) does not support them, causing runtime query errors.
**How to avoid:** Always pass `{ prepare: false }` to `postgres()` when the connection string points at the pooled (6543) endpoint.
**Confidence:** HIGH — confirmed by Drizzle's official `connect-supabase` docs and Supabase's own Supavisor FAQ.

### Pitfall 4: Supabase API key naming is mid-migration in 2026
**What goes wrong:** Supabase is migrating from legacy `anon` / `service_role` keys to new `publishable` / `secret` keys (legacy keys deprecated by end of 2026, per Supabase's own changelog). Exact env var naming shown across Supabase's own docs is inconsistent right now (some show `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Next.js apps, others show `SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS` as JSON-object env vars in a Deno/self-hosted context). A plan that hardcodes one naming convention may not match what a newly created Supabase project's dashboard actually shows.
**How to avoid:** When the Supabase project is created (Wave 0 of this phase), copy the exact key names shown in that project's Dashboard → Settings → API page rather than assuming a name from documentation. Use the **publishable** key client-side (safe to expose, same low privilege as the old `anon` key) and the **secret** key server-only (replaces `service_role`, required for `auth.admin.createUser()` in the seed script and any future admin-user-creation Server Action). Never prefix the secret key with `NEXT_PUBLIC_`.
**Confidence:** MEDIUM — the migration and security rules (publishable=public, secret=server-only) are HIGH confidence (official Supabase docs, changelog), but exact env-var-name conventions differ between docs pages and should be verified against the actual project dashboard at execution time, not assumed from this document.

### Pitfall 5: RLS is silently bypassed by Drizzle's direct Postgres connection
**What goes wrong:** A developer enables Row Level Security policies on `clientes`/`contratos` (following generic Supabase tutorials) expecting them to enforce Admin/Membro rules, but Drizzle connects via a plain Postgres connection string using the `postgres` role — which bypasses RLS by default — so the policies do nothing, giving false confidence that authorization is enforced at the DB layer.
**How to avoid:** For this phase, don't rely on RLS for Admin/Membro authorization at all — enforce it explicitly in each Server Action (read the caller's role from the session/`profiles` row, reject if the action requires Admin — e.g., delete cliente/contrato per D-03). If RLS is desired later as defense-in-depth, it requires deliberately connecting through a JWT-scoped client/role, which is out of scope here.
**Confidence:** HIGH — confirmed by Supabase's own RLS docs (RLS applies to roles queried through PostgREST/JWT-aware connections; a direct `postgres`-role connection is unaffected) and cross-referenced community discussion.

### Pitfall 6: Bootstrapping the first Admin has no UI to bootstrap it from
**What goes wrong:** Because D-02 disallows self-signup, and Phase 1 is the very first phase, there is no existing Admin account to use the (eventual) "Admin creates user" feature with — a chicken-and-egg problem.
**How to avoid:** A one-off script (`scripts/seed-admin.ts`), run manually once via `node`/`tsx` against the project's secret key, that calls `supabase.auth.admin.createUser({ email, password, email_confirm: true })` and inserts/updates the corresponding `profiles` row with `role = 'admin'`. This script is not part of the running app and is not exposed as a route.
**Confidence:** HIGH — this is the standard documented pattern (Supabase Admin API `createUser`, corroborated by multiple sources including Makerkit's "Adding a Super Admin" guide and Supabase's own Admin API reference).

## Code Examples

### Bootstrap first Admin (one-off script)
```typescript
// scripts/seed-admin.ts — run once: npx tsx scripts/seed-admin.ts
// Source: Supabase Admin API reference (auth.admin.createUser) + standard bootstrap pattern
import { createClient } from '@supabase/supabase-js'
import { db } from '../src/lib/db'
import { profiles } from '../src/lib/db/schema'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!, // server-only, never expose
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: process.env.SEED_ADMIN_EMAIL!,
    password: process.env.SEED_ADMIN_PASSWORD!,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error('createUser returned no user')

  await db.insert(profiles).values({
    id: data.user.id,
    nome: 'Admin',
    role: 'admin',
  })

  console.log(`Admin created: ${data.user.email} (${data.user.id})`)
}

main()
```

### Drizzle client with pooled connection (runtime)
```typescript
// src/lib/db/index.ts — Source: Drizzle official connect-supabase docs
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false }) // pooled, port 6543
export const db = drizzle({ client, schema })
```

### drizzle.config.ts (uses DIRECT connection for migrations)
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!, // direct connection, port 5432 — NOT the pooled URL
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` + `export function middleware()` | `proxy.ts` + `export function proxy()` | Next.js 16 (2025-2026) | Any auth guide written before this rename (including some of Supabase's own tutorial pages) will produce a silently non-functional route guard if followed literally. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Deprecated well before 2026; `@supabase/ssr` is the only actively maintained path | Do not install `auth-helpers-nextjs` even if an older tutorial references it. |
| Supabase `anon` / `service_role` keys | `publishable` / `secret` keys | Migration underway through 2026, legacy keys deprecated end of 2026 | New projects created now should default to the new key names; verify actual names in the created project's dashboard (see Pitfall 4). |
| `supabase.auth.getSession()` for access control | `supabase.auth.getUser()` for access control | Ongoing Supabase guidance | `getUser()` revalidates against the Auth server; `getSession()` trusts the local cookie, which is not safe for gating access. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: superseded by `@supabase/ssr`, no longer recommended for new projects.
- Next.js `middleware.ts`: file convention deprecated in favor of `proxy.ts` in Next.js 16 (still works for Edge-Runtime-specific use cases per Next.js docs, but Supabase Auth SSR has no reason to use Edge Runtime here — use `proxy.ts`).

## Open Questions

1. **Does "Admin cria novos usuários" (D-02) need an in-app UI in Phase 1, or is the one-off seed script sufficient?**
   - What we know: ACES-01/02/03 only require login, multi-user support, and persistent sessions — they don't explicitly require an "create user" UI. D-02 says "Apenas Admin pode criar novos usuários," which could be satisfied either by a real in-app feature (Admin-only form → Server Action → `auth.admin.createUser`) or by an operational process (Admin runs a script / uses Supabase Dashboard directly) for the ~10-person team's rare "new hire" event.
   - What's unclear: Whether the team wants to click a button in-app to add teammates, or whether "the Admin literally cannot self-signup, so I go add them via a script/dashboard" is an acceptable v1 workflow.
   - Recommendation: Given the team is very small and this event is rare, the lowest-risk default is to build the one-off seed script (needed regardless, to bootstrap the first Admin) and treat a full in-app "Adicionar usuário" screen as optional/nice-to-have for this phase — but the planner should size a small Server-Action-based "create user" form as a fallback task if the phase's UI hint (yes) is read as implying it belongs in this phase's polish. Flag for explicit confirmation before planning, since it affects task count.

2. **Should `clientes` list card query be N+1 (one query per client for current contract) or a single aggregated query/view?**
   - What we know: At ~10 clients this is a non-issue either way for performance.
   - What's unclear: Whether the planner should invest in a Postgres view (`DISTINCT ON`) now, versus a straightforward per-client Drizzle relational query, given this same "current contract" concept will be reused by Phase 4 (MRR calculation) and Phase 6 (dashboard rollup).
   - Recommendation: Build the simplest working query now (relational `findFirst` per client, or `findMany` with `orderBy` client-side grouping); revisit as a Postgres view only when Phase 4's MRR aggregation actually needs it, to avoid premature abstraction.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime (needs 20.9+) | ✓ | v24.14.1 | — |
| npm | Package installation | ✓ | 11.11.0 | — |
| git | Version control | ✓ | 2.53.0 | — |
| Supabase CLI | Local Postgres emulation, local Auth emulation (`supabase start`), type generation | ✗ (not found on PATH) | — | Use `npx supabase <cmd>` (no global install needed) for one-off commands, or develop directly against a hosted Supabase project (skip local emulation) given the small team/low-risk v1 scope — install globally later if local dev friction becomes real. |

**Missing dependencies with no fallback:**
- None — everything required to start is either present or has a viable `npx`-based fallback.

**Missing dependencies with fallback:**
- Supabase CLI — use `npx supabase@latest <command>` per-invocation, or work directly against a hosted Supabase project for this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (per CLAUDE.md "Development Tools" table) — not yet installed, greenfield project |
| Config file | none — see Wave 0 Gaps |
| Quick run command | `npx vitest run <file>` (once configured) |
| Full suite command | `npx vitest run` (once configured) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| ACES-01 | Login with email/password succeeds with valid creds, fails with invalid creds | integration (against a real/local Supabase project) or manual | manual (no local Supabase Auth emulator configured this phase) | ❌ Wave 0 (or accept manual-only, see note) |
| ACES-02 | A second user (different account) can log in independently | manual | manual browser test with 2 seeded accounts | ❌ Wave 0 |
| ACES-03 | Session persists across a page reload/new browser session | manual | manual: log in, close tab, reopen, still authenticated | ❌ Wave 0 |
| CLI-01 | Cliente Zod schema accepts valid input, rejects missing nome/nicho | unit | `npx vitest run tests/validations/cliente.test.ts` | ❌ Wave 0 |
| CLI-02 | Contrato Zod schema validates dates/valor; `valorMensal` accepts only positive numeric | unit | `npx vitest run tests/validations/contrato.test.ts` | ❌ Wave 0 |
| CLI-03 | Editing a contrato inserts a new row rather than mutating the previous one (D-06) | unit (test the Server Action / DB helper against a test DB, or unit-test the query-builder logic in isolation) | `npx vitest run tests/actions/contratos.test.ts` | ❌ Wave 0 |
| CLI-04 | "Current contract" derivation returns the row with the latest `data_inicio` for a client with multiple contract rows | unit | `npx vitest run tests/db/current-contrato.test.ts` | ❌ Wave 0 |

**Note on ACES-01/02/03:** These are inherently hard to automate cheaply without a local Supabase Auth emulator (`supabase start`), which isn't installed in this environment (see Environment Availability). Given the small scope of this phase, manual verification against a real Supabase project is an acceptable initial approach; automating these with `supabase start` + Vitest can be a later hardening task, not a Phase 1 blocker.

### Sampling Rate
- **Per task commit:** run the relevant single test file (`npx vitest run <file>`) for any task touching validation schemas or the current-contract derivation logic.
- **Per wave merge:** `npx vitest run` (full suite).
- **Phase gate:** Full suite green (for whatever automated coverage exists) + manual walkthrough of ACES-01/02/03 and CLI-01..04 before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Install and configure Vitest (`npm install -D vitest`, `vitest.config.ts`) — no test framework exists yet in this greenfield project.
- [ ] `tests/validations/cliente.test.ts` — covers CLI-01
- [ ] `tests/validations/contrato.test.ts` — covers CLI-02
- [ ] `tests/actions/contratos.test.ts` — covers CLI-03 (history-on-edit behavior)
- [ ] `tests/db/current-contrato.test.ts` — covers CLI-04 (current-contract derivation)
- [ ] Decide whether ACES-01/02/03 stay manual-only for this phase or get a `supabase start`-backed integration test (see note above) — recommend manual-only for Phase 1.

## Sources

### Primary (HIGH confidence)
- Next.js official docs — "Renaming Middleware to Proxy" (`nextjs.org/docs/messages/middleware-to-proxy`) — exact rename mechanics, codemod command.
- Next.js official docs — "Upgrading: Version 16" (`nextjs.org/docs/app/guides/upgrading/version-16`, last updated 2026-05-13, version 16.2.10) — confirmed Node 20.9+ requirement, `proxy.ts`/`nodejs`-only runtime, async request APIs fully breaking in v16.
- Supabase official docs — "AI Prompt: Bootstrap Next.js v16 app with Supabase Auth" (`supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth`) — current client/proxy code patterns, explicitly targeting Next.js 16.
- Supabase official docs — "Setting up Server-Side Auth for Next.js" (`supabase.com/docs/guides/auth/server-side/nextjs`) — client/server client code, `getClaims()`/`getUser()`/`getSession()` distinctions.
- Supabase official docs — "Managing User Data" (`supabase.com/docs/guides/auth/managing-user-data`) — `profiles` table + `handle_new_user` trigger pattern.
- Drizzle ORM official docs — "Connect Drizzle ORM to Supabase Postgres" (`orm.drizzle.team/docs/connect-supabase`) — `prepare: false`, pooled vs direct connection guidance.
- npm registry (`registry.npmjs.org`) — direct version lookups for `next`, `@supabase/supabase-js`, `@supabase/ssr`, `drizzle-orm`, `drizzle-kit`, `postgres`, `zod`, `react-hook-form` — checked 2026-07-10.
- Supabase official docs/changelog — "Migrating to publishable and secret API keys" (`supabase.com/docs/guides/getting-started/migrating-to-new-api-keys`) and "Understanding API keys" — key migration timeline, security properties.
- Supabase official docs — "Row Level Security" (`supabase.com/docs/guides/database/postgres/row-level-security`) — RLS applies through PostgREST/JWT-aware roles; direct `postgres`-role connections bypass it.

### Secondary (MEDIUM confidence)
- WebSearch aggregation (multiple 2026 sources) on Next.js + Supabase + Drizzle folder structure conventions (`src/app`, `src/lib`, `src/server`) — directionally consistent across sources, no single canonical doc.
- WebSearch aggregation on `@hookform/resolvers` + Zod 4 compatibility — confirmed compatible as of March 2026 in the version line CLAUDE.md already pins (5.4.x), some historical GitHub issues on earlier resolver versions.
- WebSearch on Supabase transaction-pooler prepared-statement limitation — cross-referenced across Drizzle docs, Supabase Supavisor FAQ, and community migration write-ups; all agree.
- Makerkit "Adding a Super Admin to your Next.js Supabase application" — corroborates the Admin API `createUser` bootstrap pattern (third-party but widely-cited implementation guide, consistent with Supabase's own Admin API reference).

### Tertiary (LOW confidence)
- None flagged — all findings above were cross-verified against at least one official source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified live against npm registry same-day; matches CLAUDE.md's own research.
- Architecture (auth/proxy pattern, Drizzle schema, contract history): HIGH for the `proxy.ts` rename and connection-pooling rules (official docs); MEDIUM for exact folder-structure naming (convention, not a spec) and for the RLS-vs-app-level-auth recommendation (a reasoned tradeoff given project scale, not a single documented "correct" answer).
- Pitfalls: HIGH — each pitfall traced to an official doc or cross-verified multi-source finding; Pitfall 4 (API key naming) explicitly flagged MEDIUM since Supabase's own docs are inconsistent mid-migration.

**Research date:** 2026-07-10
**Valid until:** ~2026-08-10 (30 days) — shorter validity recommended specifically for the Supabase API key naming migration (Pitfall 4) and Next.js 16.x point-release changes; re-verify `proxy.ts` behavior and exact env var names against the live Supabase dashboard at execution time regardless of this document's age.
