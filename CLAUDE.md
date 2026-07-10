<!-- GSD:project-start source:PROJECT.md -->
## Project

**Sistema JSR (Agência JSR)**

Sistema interno de gestão para a JSR, uma agência de marketing digital focada em tráfego pago (que também presta serviços de landing pages, CRM, estruturação e estratégia). Unifica em um só lugar a visão geral do negócio, a gestão de clientes (contratos, tráfego pago, social, mídia, relatórios) e a operação diária (verba, checklists, acompanhamento), substituindo hoje uma combinação dispersa de ferramentas (ClickUp, planilhas, conferência manual de contas de anúncio) e processos manuais.

**Core Value:** Dar à equipe da JSR visibilidade em tempo real da saúde de cada cliente (verba, campanhas, contratos, financeiro) em um único painel, com alertas proativos — eliminando o risco de "descobrir tarde demais" (verba zerada, contrato vencido) e o tempo gasto montando relatórios manualmente.

### Constraints

- **Escala inicial**: Poucos clientes ativos (~10) e equipe pequena — não é preciso projetar para alta escala desde o v1
- **Integrações**: Depende de acesso a APIs externas (Meta Ads, Google Ads) para dados de campanha e verba — sujeito a limites/autenticação dessas plataformas
- **Uso interno**: v1 não precisa de portal externo para clientes, o que simplifica autenticação/permissões no início
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | 16.2.x (Node.js 20.9+ required) | Full-stack framework — UI, Server Actions, Route Handlers for webhooks/cron endpoints | Single deployable for a solo/small-team builder: server-rendered dashboard, API routes for OAuth callbacks and cron-triggered polling, and the client UI all live in one codebase. This is the de facto standard for indie/small-team internal SaaS tools built by 1-3 devs in 2025/2026. |
| TypeScript | 5.x | Type safety across DB schema, API integration payloads, and UI | Non-negotiable for this project: you're parsing external API responses (Meta/Google Ads) with drifting shapes and doing financial math (MRR, budgets) — type safety catches shape/unit mistakes at compile time. |
| Supabase (Postgres + Auth + Realtime + Storage) | `@supabase/supabase-js` 2.110.x, Postgres 15/17 (managed) | Database, internal team auth, live alert updates | One managed service gives you: a real Postgres DB (relational data — clients, contracts, campaigns, alerts, payments — fits a relational model far better than a NoSQL/BaaS doc store), built-in auth for the 5-10 internal users (no need for a separate auth vendor), and Realtime subscriptions so a new "budget low" alert appears in the UI without polling. This combo is the most common pairing for exactly this project profile (Next.js + small internal tool + Vercel) in current templates and guides. |
| Drizzle ORM + drizzle-kit | `drizzle-orm` 0.45.x, `drizzle-kit` 0.31.x | Type-safe SQL access + migrations | Lightweight (no Rust binary/query engine to bundle into serverless functions, unlike older Prisma versions), migration files are plain SQL you can read/review, and it pairs natively with Supabase's Postgres. Given the schema here (clients, contracts, campaigns, alerts, payments) is moderately relational but not huge, Drizzle's closer-to-SQL model keeps queries (e.g. MRR aggregation) transparent instead of hidden behind an abstraction. |
| Tailwind CSS + shadcn/ui | `tailwindcss` 4.3.x, `shadcn` CLI 4.13.x | UI styling + component primitives (tables, dialogs, forms, charts) | Fastest path to a clean, functional internal dashboard for a small team with no dedicated designer. shadcn/ui ships accessible, copy-into-your-repo components (not an npm dependency you fight), including a chart wrapper built on Recharts — exactly what's needed for budget/spend visualizations. |
| Inngest | `inngest` 4.12.x | Background job orchestration: daily Meta/Google Ads polling, weekly report generation, alert evaluation | This project's core technical risk isn't compute — it's **reliable scheduled jobs with retries against flaky/rate-limited third-party APIs**, run on serverless (Vercel) infrastructure. Inngest functions are defined as normal code in your Next.js repo, invoked via a single API route, support built-in step-level retries/backoff (critical for Meta's 429/rate-limit responses), and its free tier comfortably covers ~10 clients × 2 ad platforms × daily runs. It removes the need for a separate always-on worker/queue (BullMQ + Redis) that a 2-platform, ~10-account workload doesn't justify. |
| Vercel | — | Hosting/deployment | Next.js's native deployment target; zero-config for Server Actions, Route Handlers, and preview deployments. Pairs cleanly with Inngest (Inngest calls back into a Vercel-hosted route) without needing a separate always-on server. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `google-ads-api` (Opteo) | 24.1.x | Google Ads API client (OAuth, GAQL queries, reporting) | Primary integration path for pulling campaign/budget/spend data from Google Ads. Actively maintained, TypeScript-first, wraps GAQL query building — use for all Google Ads reads (see Meta/Google Ads section below). |
| `facebook-nodejs-business-sdk` **or** direct `fetch` against Graph API | 24.0.x (Meta's official SDK, versioned to Graph API) | Meta Marketing API client (campaigns, ad accounts, insights) | Use the official SDK to get started quickly (handles auth object plumbing). If you hit friction with stale SDK typings lagging behind the Graph API version you need, fall back to plain `fetch` calls against `graph.facebook.com/v25.0/...` with Zod-validated response parsing — this is a common pattern for teams that outgrow the SDK's abstraction. Either way, **pin the Graph API version explicitly** in every request/SDK init (see pitfalls below). |
| Zod | 4.4.x | Runtime validation of external API responses, form input, Server Action input | Mandatory, not optional, given this project ingests untrusted/drifting shapes from two ad-platform APIs and computes financial numbers from them. Validate every Meta/Google Ads response at the boundary before writing to Postgres. |
| React Hook Form + `@hookform/resolvers` | `react-hook-form` 7.81.x, `@hookform/resolvers` 5.4.x | Forms: client creation, contract entry, alert threshold config | Standard pairing with Zod for the CRUD-heavy parts (client/contract/financial data entry) that make up a large share of this app's surface area. |
| TanStack Query | `@tanstack/react-query` 5.101.x | Client-side data fetching/caching for interactive views (live budget dashboard, alert inbox) | Next.js Server Components handle most initial data loads; reach for React Query specifically where the UI needs client-side refetch/optimistic updates (e.g., marking an alert as read, manual "refresh now" on the budget panel). Don't use it to replace Server Components wholesale. |
| Resend | 6.17.x | Email delivery | **Optional for v1** — the spec calls for in-app alerts only. Add this later if the team wants an email digest for critical alerts (e.g., verba zerada) so no one has to keep the app open. Cheap to bolt on later; not a v1 blocker. |
| `postgres` (porsager/postgres) | 3.4.x | Postgres driver used by Drizzle to connect to Supabase | Use with Supabase's **pooled connection** (port 6543, PgBouncer, transaction mode) for anything running in a serverless function (Server Actions, Route Handlers, Inngest functions); use the **direct** connection (port 5432) only for running migrations. Mixing these up is the #1 cause of "too many connections" errors on serverless Postgres. |
| Vercel AI SDK + `@anthropic-ai/sdk` | `ai` 7.0.x, `@anthropic-ai/sdk` 0.111.x | Optional: natural-language phrasing for the weekly report text | **Defer unless needed.** The weekly report's *numbers* (spend, budget remaining, top campaigns) must come from deterministic template logic against your own DB — never let an LLM compute or restate financial figures. If/when the team wants more natural prose wrapped around those numbers (vs. a plain structured template), add an LLM call that receives the already-computed numbers as structured input and only handles phrasing. Not required for MVP; a well-designed text template segmented by goal-type (e-commerce/local/infoproduct) satisfies the "copy-paste ready" requirement on its own. |
| `date-fns` | 4.4.x | Date math for contract renewal windows, MRR period calculations, report date ranges | Lighter than Moment/Luxon for the kind of date arithmetic this app needs (renewal countdowns, "last 7 days" report windows). |
| Recharts (via shadcn/ui chart components) | 3.9.x (pulled in by shadcn's chart blocks) | Budget/spend trend charts on client and dashboard views | Don't add Tremor (see "What NOT to Use") — use shadcn/ui's chart components, which wrap Recharts and match the rest of the UI kit. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Drizzle Kit Studio (`drizzle-kit studio`) | Local DB browser/GUI | Use during development to inspect client/contract/campaign data without writing throwaway SQL. |
| Supabase CLI | Local Postgres, migrations, type generation, local Auth emulation | Run `supabase start` for a local dev DB that mirrors production; avoids developing directly against the shared cloud project. |
| ngrok / Cloudflare Tunnel | Local HTTPS tunnel for OAuth redirect testing | Both Meta and Google OAuth flows require HTTPS redirect URIs — needed to test the Meta/Google Ads authorization flow from `localhost` during development. |
| Vitest | Unit tests for report-generation templates and financial (MRR) calculation logic | Prioritize testing the deterministic logic (report text assembly, MRR math, alert threshold evaluation) over UI — that's where silent bugs are costly (wrong numbers shown to clients). |
| ESLint + Prettier (or Biome) | Linting/formatting | Biome is a viable single-tool replacement for both if the team wants faster CI and less config; either is fine for a small team. |
## Installation
# Core
# Background jobs
# Ad platform integrations
# Validation, forms, data fetching
# UI
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Supabase (Postgres + Auth) | Neon (Postgres) + Clerk (Auth) | If the team wants best-in-class auth UX (SSO, org invites, polished admin UI) and doesn't need Realtime/Storage — Clerk's free tier covers 5-10 internal users easily. Adds a second vendor vs. Supabase's all-in-one, but auth setup is genuinely faster with Clerk. |
| Drizzle ORM | Prisma 7 | If the team prefers Prisma's schema-first DX and wants Prisma Studio as the DB GUI, and is less comfortable writing closer-to-SQL queries. Prisma 7 dropped the old Rust query-engine binary (better serverless cold-start behavior than pre-7 Prisma), closing the main historical gap with Drizzle. Either is a defensible choice here; Drizzle is recommended for transparency of the MRR/reporting queries. |
| Inngest | Trigger.dev v4 | If report generation grows to include long-running steps (e.g., multiple chained LLM calls, PDF rendering, or per-client jobs that individually run several minutes) — Trigger.dev runs on dedicated compute with no serverless-style step time limits and has stronger run-by-run observability/debugging tooling. Overkill for this project's current daily-polling / weekly-report scope. |
| Inngest | Vercel Cron Jobs (raw `route.ts` + `vercel.json` schedule) | Only if the team wants the absolute simplest possible v1 with zero extra services, and is comfortable hand-rolling retry/backoff logic for Meta's 429 responses. Vercel Hobby plan also restricts cron frequency (effectively once/day), which is workable here (daily polling matches the current manual routine) but leaves no headroom for later intraday alerting without upgrading to Pro. |
| `google-ads-api` (Opteo) | Official `google-ads-node` / raw REST | Opteo's library is community-maintained (not Google's own), but is the most ergonomic TypeScript option and is what most Node integrations in the wild use. If strict "only use vendor-official libraries" is a hard requirement, use direct REST calls with `google-auth-library` for OAuth instead. |
| shadcn/ui charts (Recharts) | Tremor (`@tremor/react`) | Don't — see "What NOT to Use." |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Tremor (`@tremor/react`) for dashboard charts | Last published to npm in January 2025 — over a year stale as of this research, no signs of active maintenance. Building a core dashboard visualization layer on a stalled library is a real risk for a tool meant to run for years. | shadcn/ui chart components (built on Recharts, actively maintained, matches the rest of your UI kit). |
| BullMQ + Redis for job scheduling | Requires an always-on worker process and a Redis instance — real operational overhead (deployment, monitoring, scaling) for a workload that's ~10 clients × 2 platforms × a handful of scheduled runs per day. This is infrastructure sized for a much bigger job volume than this project has. | Inngest (serverless-native, no worker process to run/monitor). |
| next-auth / Auth.js v5 | Still in beta (`5.0.0-beta.31` as of this research) after roughly two years in beta — not something to build a production internal tool's auth on when a stable, fully-managed alternative (Supabase Auth) already covers the exact need (5-10 internal users, simple auth). | Supabase Auth (already included with the recommended DB), or Clerk if you want a more polished admin UI for user management. |
| Letting an LLM compute or restate the report's financial numbers directly from a prompt | LLMs are unreliable at exact arithmetic and can silently alter numbers (spend, remaining budget, % change) — unacceptable for a report a client will read. | Compute all numbers deterministically in your own code/DB queries; if you add an LLM step at all, feed it the already-correct numbers and only let it handle prose/phrasing. |
| Meta's official Node SDK as the *only* long-term integration path without a fallback plan | The `facebook-nodejs-business-sdk` versioning trails the Graph API's actual current version, and Meta deprecates/retires API versions on a rolling schedule (v20.0 deprecates Sept 2026, for example) — a poorly-pinned integration silently breaks. | Explicitly pin the Graph API version string in every request; monitor Meta's Graph API changelog; be ready to bypass the SDK with direct `fetch` calls if the SDK lags a version you need. |
| Building a custom OAuth "connect your ad account" flow per client in v1 | Not needed for this project's actual setup — see Meta/Google Ads integration section below. Building multi-tenant OAuth (each client authorizing your app individually) is real complexity this project doesn't need in v1 because the agency already manages all client ad accounts under its own Meta Business Manager / Google Ads Manager (MCC) account. | Use a single System User token (Meta) and a single agency-level OAuth refresh token against the MCC (Google), both authorized once by the agency, covering all client accounts shared with/linked to those top-level accounts. |
## Meta Marketing API & Google Ads API Integration Approach
### Meta Marketing API (Graph API / Marketing API)
- **Current API version:** v25.0 (released Feb 18, 2026). v20.0 deprecates Sept 24, 2026 — always pin an explicit version in requests and track Meta's changelog (`developers.facebook.com/docs/graph-api/changelog`). MEDIUM-HIGH confidence, verified via Meta's own changelog pages.
- **Auth flow to use:** Because the agency itself manages all ~10 clients' ad accounts inside its own Meta **Business Manager** (this is how agencies operate on Meta — client accounts are added as shared/managed ad accounts, not separately owned apps), you do **not** need a per-client OAuth consent screen. Instead:
- **Data to pull:** Ad account status, campaign/ad set status (active/paused), remaining budget/spend, and the Ads Insights endpoint for performance metrics (impressions, spend, results) needed for the weekly report — segmented per client's goal type (e-commerce/local/infoprodutos will map to different insight fields, e.g. purchase ROAS for e-commerce vs. lead/message metrics for local/info).
- **Rate limits:** Spend-based, not fixed-count — each response includes an `X-Business-Use-Case-Usage` header reporting current consumption percentage per rate-limit bucket; above 80% back off, at 100% you'll get error code 17 / HTTP 429 until the rolling window regenerates. At ~10 client accounts with daily polling, this project is nowhere near these limits, but the Inngest job should still implement exponential backoff on 429s as a defensive default. MEDIUM confidence (rate-limit mechanics verified across multiple current sources but Meta doesn't publish exact numeric thresholds by tier publicly in a single authoritative doc).
- **Async Insights API note:** For anything beyond simple current-status pulls (e.g., a full week of daily breakdowns for the weekly report), use the Ads Insights **Async** job pattern (submit a report request, poll for completion) rather than synchronous calls, which is what Meta recommends for larger report pulls and reduces rate-limit pressure.
### Google Ads API
- **Auth flow to use:** Similarly, if the agency's client accounts are linked under the agency's own **Manager account (MCC)**, a **single** OAuth authorization by the agency owner (one-time consent flow) yields one refresh token that — combined with the MCC's `login-customer-id` header — can query every linked client account. No per-client OAuth needed in v1.
- **Critical setup blocker — start this immediately, before any coding:** Google Ads API access requires a **developer token**, and a newly-created token starts at "Test Account Access" only (can't touch real client accounts). To access production client accounts, you must apply for **Basic Access**, which as of early 2026 Google has publicly acknowledged is running **multi-week backlogs**, not days, due to high application demand. **This should be the very first thing done in this project — apply for the developer token and Basic Access approval on day one**, since it's the one dependency in this stack that isn't under the team's control and can silently block the entire Google Ads half of the product for weeks if started late. HIGH confidence — directly stated in Google's own Ads Developer Blog (Feb 2026) and corroborated by community reports of the same backlog.
- **Data to pull:** Use GAQL (Google Ads Query Language) via the client library's `.query()` method against the `campaign`, `campaign_budget`, and `ad_group` resources for status/budget, and the `metrics` fields (cost_micros, clicks, conversions, conversion_value) for the weekly report — again segmented by goal type (conversion value/ROAS for e-commerce, calls/store visits or leads for local, conversions for infoproduct/lead-gen).
- **Rate limits:** Basic Access grants a fixed daily operations quota (historically 15,000 operations/day, small-account-friendly); at ~10 client accounts with daily polling this project will use a small fraction of that. No mitigation needed beyond normal error handling for `RESOURCE_EXHAUSTED` responses.
### Scheduling both integrations
## Stack Patterns by Variant
- Change the Inngest cron schedule frequency (e.g., every 2-4 hours) — no infrastructure change needed, since Inngest scheduling is independent of Vercel's plan-based cron restrictions.
- Watch Meta/Google rate limits more carefully at higher polling frequency, though at ~10 clients this is still unlikely to be an issue.
- Then true per-client OAuth (each client authorizing your app to see their account) becomes necessary for those accounts — this is meaningfully more complex (consent screens, token storage per client, handling revocation) and should be scoped as its own phase if/when it comes up, not assumed as part of v1.
- Consider a dedicated Postgres view (or materialized view refreshed by an Inngest job) for MRR aggregation rather than computing it ad hoc in the UI layer, to keep the number consistent everywhere it's displayed.
- Migrate from Supabase Auth to Clerk — both use standard JWT-based sessions so this is a moderate, not total, rewrite of the auth layer.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.2.x` | Node.js 20.9+ (Node 18 unsupported) | Verify the deployment target (Vercel build image / local dev) is on Node 20 or 22 LTS before starting. |
| `drizzle-orm@0.45.x` | `postgres@3.4.x` driver, `drizzle-kit@0.31.x` | Use `postgres` driver against Supabase's **pooled** connection string (port 6543, `?pgbouncer=true`) for app runtime; use the **direct** connection string (port 5432) only in `drizzle-kit` migration commands, not at runtime — pooled connections don't support the session-level features migrations sometimes need. |
| `inngest@4.12.x` | Next.js Route Handlers (App Router) | Inngest functions are served via a single `app/api/inngest/route.ts` handler; no separate server process required, deploys as part of the normal Vercel build. |
| `google-ads-api@24.1.x` | Requires an **approved** developer token (Basic Access) to touch non-test accounts | See "Google Ads API" integration section — this is an account/approval dependency, not a code dependency, but it gates when the integration can go live against real data. |
| `facebook-nodejs-business-sdk@24.0.x` | Graph API v25.0 currently live | SDK major version numbers track Graph API version numbers but may lag by one; if a needed field/endpoint isn't in the SDK's types yet, call the REST endpoint directly with an explicit `?...&access_token=` + version path instead of waiting on an SDK update. |
## Sources
- Meta for Developers — Graph API Changelog & Versions (`developers.facebook.com/docs/graph-api/changelog`, `.../changelog/versions/`) — confirmed current version v25.0 (Feb 2026), v20.0 deprecation date. HIGH confidence.
- Meta for Developers — Graph API v25.0 changelog page — Ads Insights async error detail additions, Advantage+ campaign phase-out. MEDIUM-HIGH confidence.
- Google for Developers — Google Ads API Developer Token & Access Levels docs (`developers.google.com/google-ads/api/docs/api-policy/developer-token`, `.../access-levels`) — Test vs Basic vs Standard access tiers. HIGH confidence.
- Google Ads Developer Blog, Feb 2026 — "An update on Google Ads API developer token access applications" — confirms multi-week backlog on Basic Access approvals as of early 2026. HIGH confidence (primary source, dated).
- npm registry (`registry.npmjs.org`) — direct version lookups for `next`, `@supabase/supabase-js`, `drizzle-orm`, `drizzle-kit`, `inngest`, `@trigger.dev/sdk`, `google-ads-api`, `facebook-nodejs-business-sdk`, `zod`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `tailwindcss`, `shadcn`, `resend`, `date-fns`, `postgres`, `pg`, `next-auth`, `@tremor/react` (including last-publish date). HIGH confidence — live registry data, checked 2026-07-10.
- Next.js official docs — "Upgrading: Version 16" (`nextjs.org/docs/app/guides/upgrading/version-16`) — Node.js 20.9 minimum requirement. HIGH confidence.
- WebSearch aggregation (multiple 2026-dated dev-blog/community sources) on Next.js+Supabase+Drizzle as a common current starter combo, and on Inngest vs. Trigger.dev vs. Vercel Cron vs. BullMQ tradeoffs. MEDIUM confidence — cross-referenced across several independent sources but not a single authoritative doc; directionally consistent with the npm registry maintenance-activity evidence (e.g., Tremor's staleness).
- Meta System User token best-practice guidance and Business Use Case rate-limit header behavior — MEDIUM confidence, corroborated across multiple current integration guides though not a single official Meta doc page.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
