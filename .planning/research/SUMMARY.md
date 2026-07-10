# Project Research Summary

**Project:** Sistema JSR (Agência JSR)
**Domain:** Internal B2B ops dashboard for a paid-traffic agency — ad-spend visibility, alerting, and automated client reporting (Meta Ads + Google Ads integration), small internal team (~5-10 users), ~10 clients
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

Sistema JSR sits at the intersection of two mature, well-understood product categories — automated ad-reporting tools (AgencyAnalytics, Swydo, Reportei) and agency PSA/ops platforms (Productive.io, Scoro) — but no single reference product combines them for a small paid-traffic agency. That combination (ad health + contracts + financials in one lightweight internal dashboard) is itself the project's core differentiator, not any individual feature. The market strongly validates two of the project's specific choices: WhatsApp-ready copy/paste report output (matching the BR "gestor de tráfego" niche pattern, e.g. Metrifiquei/GT Report, rather than the global portal/PDF default) and segmenting report content by client business objective (e-commerce/local/infoproduto) — the latter is a genuine market gap, not a solved pattern to copy.

The recommended approach is a straightforward, boring-on-purpose architecture: a single Next.js + TypeScript app, Supabase Postgres as the sole system of record, and a scheduled sync layer that is the *only* component allowed to call the Meta and Google Ads APIs — the dashboard, alerting engine, and report generator all read exclusively from synced DB snapshots, never live from ad platforms. This "sync-then-consume" pattern, combined with append-only time-series storage (not overwritten "current state" rows), is what makes trend reporting, week-over-week comparisons, and consistent numbers across the dashboard/alerts/reports possible without rework later. At ~10 clients this does not need queues, microservices, or a data warehouse — Inngest (or even plain Vercel Cron) handles the daily/weekly scheduled jobs.

The dominant risk is not technical complexity but reliability and trust: silent auth/token expiry (Meta long-lived tokens only refresh on active use; Google Ads refresh tokens expire in 7 days if the OAuth consent screen is left in "Testing"), attribution lag making report numbers look "wrong" days after being sent, and alert fatigue from un-debounced threshold checks — each of which, if it happens even a few times, teaches the team to stop trusting or using the tool (the single most common failure mode for internal dashboards). A second, external risk is largely outside the team's control: Google Ads API Basic Access approval is running multi-week backlogs as of early 2026, and this should be applied for on day one of the project, before any integration code is written, since it can silently block the entire Google Ads half of the product for weeks if started late.

## Key Findings

### Recommended Stack

Next.js 16 (App Router) + TypeScript + Supabase (Postgres/Auth/Realtime) + Drizzle ORM forms the core — a single deployable, relationally-modeled system that fits this project's data shape (clients, contracts, campaigns, alerts, payments) far better than a NoSQL/BaaS doc store. Inngest handles scheduled background jobs (daily Meta/Google Ads polling, weekly report generation, alert evaluation) with built-in retry/backoff against rate-limited APIs, without requiring an always-on worker + Redis (BullMQ is explicitly oversized for this workload). Tailwind + shadcn/ui (Recharts-based charts, not Tremor — which is stale) gives a fast path to a clean internal dashboard with no dedicated designer.

**Core technologies:**
- Next.js 16 (App Router) + TypeScript — single codebase for UI, Server Actions, and cron/webhook API routes
- Supabase (Postgres + Auth + Realtime) — relational system of record, built-in internal-user auth, live alert updates
- Drizzle ORM + drizzle-kit — type-safe, transparent SQL access; keeps MRR/reporting queries auditable
- Inngest — serverless-native scheduled jobs with step-level retry/backoff for Meta/Google rate limits, no separate worker process
- `google-ads-api` (Opteo) + `facebook-nodejs-business-sdk`/direct `fetch` — ad platform clients, with explicit API version pinning
- Zod — mandatory runtime validation of external API responses and financial input at every boundary

**Critical external dependency:** Google Ads API developer token (Basic Access) approval — apply on day one; multi-week backlog reported by Google itself (Feb 2026 dev blog).

### Expected Features

Feature research confirms PROJECT.md's Active requirements are already well-scoped — nearly a 1:1 match with what the market's table-stakes features look like for this category, which is a good sign. The genuine differentiators (objective-based report segmentation, WhatsApp-native format, unified ops+financial view) are validated as real market gaps, not "nice to haves" invented internally.

**Must have (table stakes):**
- Multi-client overview dashboard (portfolio view)
- Automated Meta Ads + Google Ads data pull (account/campaign status, budget, spend)
- Campaign/account status monitoring, budget threshold alerts (per-client configurable)
- Client/contract module + contract renewal alerts
- Automated recurring report generation with period-over-period comparison
- Financial layer (billing dates, revenue, MRR) derived from the contract module, not a separate ledger
- Multi-user internal access (no client-facing roles needed)

**Should have (competitive differentiators):**
- Report content segmented by client objective (e-commerce/local/infoproduto) — validated market gap
- WhatsApp-optimized copy/paste report format — matches BR niche pattern, not global portal default
- Contract alerts carrying MRR-at-risk context (date + revenue in one alert)
- Proactive "what needs attention today" combined view

**Defer (v2+):**
- Client-facing portal, automated billing/invoicing, WhatsApp Business API auto-send, AI-powered insights/anomaly detection, in-tool campaign optimization (pause/adjust budget) — all explicitly out of scope per PROJECT.md and confirmed as premature by research (each crosses from read-only visibility into a materially higher-risk write/operational tier).

### Architecture Approach

The system is a sync-then-consume pipeline: a Sync/Ingestion Layer (isolated from the request path) is the sole component that talks to Meta/Google Ads APIs, normalizing both platforms into one internal schema and upserting idempotent, timestamped snapshots into Postgres. The Alerting Engine and Report Generator are decoupled consumers that read only from the DB — never live from ad APIs — which keeps dashboard/alert/report numbers mutually consistent and resilient to platform API slowness. Contract/financial alerting runs on an independent, ad-sync-agnostic schedule since it's date-based, not ad-data-based.

**Major components:**
1. Sync/Ingestion Layer — scheduled Meta/Google connectors, auth, normalize, idempotent upsert into time-series tables
2. Data Layer (Postgres) — single source of truth: clients, contracts, financials, ad_accounts, spend_snapshots (time series), alert_rules/alerts, reports, users
3. Alerting Engine — reads DB, evaluates budget-threshold and contract-expiry rules, writes alert records with open/acknowledged/resolved state
4. Report Generator — reads synced snapshots, selects template by client goal_type, renders copy/paste-ready weekly report
5. Web Dashboard — the only component end users touch; reads exclusively from the Data Layer, never calls ad APIs directly

### Critical Pitfalls

1. **Attribution lag mistaken for a bug** — Meta/Google data can revise for up to 28 days; always show a visible "data as of HH:mm" timestamp on every figure and don't chase phantom discrepancies against Ads Manager.
2. **Auth breaks silently** — Meta long-lived tokens only refresh on active app use; Google Ads refresh tokens expire in 7 days if left in "Testing" mode. Track `last_successful_sync_at` per client as its own stale-sync alert category, separate from budget/contract alerts.
3. **Alert fatigue from un-debounced checks** — a threshold read during a partial/transient sync fires a false alert; require persistence across 2+ sync cycles and explicit open/acknowledged/resolved state, or the team learns to ignore alerts entirely (defeats the core value prop).
4. **Dashboard becomes "yet another tool nobody opens"** — must replace the exact two existing daily/weekly rituals (daily account check, Monday report) end-to-end early, rather than shipping a broad partial dashboard across many features first.
5. **Underestimating API access-level lead time** — Google Ads Basic Access and Meta Business Verification/Advanced Access are slow, externally-gated processes; confirm access level and test against 2-3 real (non-agency-owned) client accounts at the very start of the integration phase, not at the end.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Client/Contract Module + Auth + Data Model
**Rationale:** Foundational data model that almost everything else depends on (budget alerts, contract alerts, financial layer, dashboard all need per-client config and the contract record to exist first); has no dependency on the ad-platform integration, so it can start immediately while API access applications are in flight.
**Delivers:** Client records (with objective/vertical field), contract records (dates, values, status), per-user internal auth/multi-user access, base Postgres schema (including time-series-ready `spend_snapshots` table design even before it's populated).
**Addresses:** Client/Contract module, Multi-user internal access (FEATURES.md table stakes).
**Avoids:** Pitfall #10 (over-engineering) — keep the auth/permission model to a simple internal role check, not a generalized RBAC system.

### Phase 2: Ad Platform Integration (Meta + Google Ads Sync Layer)
**Rationale:** Highest-risk, most externally-gated part of the project — should start as early as possible because Google Ads Basic Access approval and Meta Business Verification are slow processes outside the team's control. Apply for Google Ads developer token access on day one of this phase, before writing integration code.
**Delivers:** System User (Meta) / single MCC OAuth (Google) auth setup, scheduled sync connectors normalizing both platforms into one schema, idempotent upsert into time-series snapshots, sync-health monitoring (`last_successful_sync_at` per client, surfaced as its own stale-sync indicator), currency/timezone captured per client ad account from day one.
**Uses:** Inngest scheduled functions, `google-ads-api`, `facebook-nodejs-business-sdk`/direct fetch, Zod validation at the API boundary.
**Implements:** Sync/Ingestion Layer, Data Layer time-series tables.

### Phase 3: Daily Visibility — Traffic Panel, Budget Alerts, Performance View
**Rationale:** This is the direct replacement for the team's current daily manual account-check ritual — per pitfall #4, this should be one of the earliest fully-working end-to-end slices, not a partial feature bolted onto a broader dashboard later.
**Delivers:** Per-client traffic panel (account status, budget remaining, active/paused campaigns), campaign/creative performance view, budget-low alerts with per-client configurable thresholds, debounced/persisted alert logic with open/acknowledged/resolved state.
**Addresses:** Campaign/account status monitoring, budget-low alerts, campaign/creative performance view (FEATURES.md table stakes).
**Avoids:** Pitfall #3 (alert fatigue) — debounce/persistence and alert state must be part of initial design, not a v2 patch.

### Phase 4: Contract & Financial Layer
**Rationale:** Depends only on Phase 1's client/contract module, not on the ad-sync layer — can be built in parallel with or immediately after Phase 2/3 since it has no ad-platform dependency. Groups naturally since the financial layer must derive from (not duplicate) contract data.
**Delivers:** Contract renewal alerts (tiered 90/60/30-day reminders), financial layer (billing dates, revenue, MRR derived from active contract values, not a separate ledger), lightweight audit trail/"last updated" tracking on financial records.
**Addresses:** Contract renewal alerts, financial layer/MRR (FEATURES.md table stakes).
**Avoids:** Pitfall #8 (financial data drift) — build the audit trail alongside core CRUD, not as a later addition.

### Phase 5: Automated Weekly Report Generation
**Rationale:** Depends on both the ad-sync layer (Phase 2, for metrics) and the client module (Phase 1, for objective/vertical to select a template) — sequenced after both exist and have real data flowing through them, matching the dependency graph in FEATURES.md. Replaces the second core manual ritual (Monday report assembly), so it should not be delayed indefinitely once its dependencies are ready.
**Delivers:** Scheduled/on-demand report generation, template selection by client goal_type (e-commerce/local/infoproduto), copy/paste/WhatsApp-ready text output, period-over-period comparison.
**Addresses:** Automated weekly report generation, report segmentation by client objective (FEATURES.md differentiator).
**Avoids:** Pitfall #1 (attribution lag) and Pitfall #6 (rate-limit batch failures) — build the "data as of" window logic and queued/staggered report generation from the start, not after the first Monday-morning failure.

### Phase 6: Unified "Needs Attention Today" Dashboard
**Rationale:** A rollup by nature — depends on nearly everything else (status monitoring, budget alerts, contract alerts, financial layer) already existing, so it is correctly sequenced last, though partial/incremental versions can exist earlier as each underlying feature ships.
**Delivers:** Prioritized cross-client view surfacing what needs attention (low budget, stale sync, expiring contract, MRR-at-risk context) instead of a flat client list.
**Addresses:** Multi-client overview dashboard, contract alerts with MRR-at-risk context (FEATURES.md differentiator).
**Avoids:** Pitfall #4 — this is the "complete" version of the daily workflow replacement; don't let it precede the narrower Phase 3/4 versions the team can already start relying on daily.

### Phase Ordering Rationale

- Client/Contract Module and Ad Platform Integration are both foundational and independent of each other (per FEATURES.md dependency graph) — Phase 1 and the *start* of Phase 2 (especially the slow external approval steps) can run concurrently in practice, even though they're listed sequentially here.
- Budget alerts and contract alerts both need the Client Module's per-client config before they can exist — Phase 1 must land before Phase 3/4's alerting logic.
- Report generation is deliberately sequenced after both the sync layer and client module are proven with real data (not synthetic), consistent with Pitfall #4's guidance to validate against real usage before adding more surface area.
- The unified dashboard is last because it's a rollup, not a standalone feature — building it before its inputs exist would produce an empty or fake-feeling screen.
- Pitfall #9 (scope creep into write/operational features) and Pitfall #10 (over-engineering for scale not needed) apply across all phases as standing checks, not a single phase — flag any phase proposing ad-account write access, auto-send, or generalized/pluggable architecture for re-evaluation against PROJECT.md's Out of Scope list.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Ad Platform Integration):** Highest novelty and external-dependency risk — Meta System User setup, Google Ads MCC/`login-customer-id` configuration, exact access-tier requirements (Standard vs. Advanced for Meta, Basic Access timeline for Google), and rate-limit/backoff implementation details all warrant `/gsd:research-phase` before implementation.
- **Phase 5 (Report Generation):** Template/segmentation logic design (mapping objective → metrics/fields per vertical) and rate-limit-safe batch generation for the Monday-morning run are non-trivial enough to warrant a focused look, even though the underlying pattern (sync-then-consume) is already well understood.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard CRUD data modeling and internal auth — well-documented Next.js/Supabase/Drizzle patterns.
- **Phase 3 (Daily Visibility) and Phase 4 (Contract & Financial Layer):** Standard dashboard/CRUD/alerting patterns once the sync layer and data model exist — established design already captured in ARCHITECTURE.md and PITFALLS.md.
- **Phase 6 (Unified Dashboard):** Primarily a UI/query composition layer over already-built data — low novelty.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core framework/DB/hosting choices verified against live npm registry data and official docs; MEDIUM specifically on background-job orchestrator choice (Inngest vs. Vercel Cron vs. Trigger.dev) — directionally consistent across sources but not a single authoritative comparison. |
| Features | MEDIUM-HIGH | Feature patterns cross-verified across multiple category-leading products (AgencyAnalytics, Swydo, Reportei, Productive.io); BR-market specifics and internal-tool sizing draw on fewer, more niche sources. |
| Architecture | MEDIUM-HIGH | Overall shape (sync layer to data store to consumers) verified against official Meta/Google rate-limit docs and multiple 2026 background-job architecture guides; small-scale implementation specifics (cron vs. queue threshold) are reasoned from the project's stated constraints rather than a single definitive source. |
| Pitfalls | MEDIUM-HIGH | API mechanics (token expiry, rate limits, access tiers) verified against official Meta/Google documentation (HIGH); dashboard-adoption and alert-fatigue failure patterns corroborated across multiple independent industry sources (MEDIUM-HIGH). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Google Ads Basic Access approval timeline:** External dependency, multi-week backlog reported as of early 2026, entirely outside the team's control — must be applied for on day one of Phase 2, tracked as a blocking risk in roadmap planning, not assumed to resolve quickly.
- **Meta access tier requirement (Standard vs. Advanced Access):** Needs to be confirmed against the agency's actual Business Manager structure early in Phase 2 — if clients' ad accounts aren't already shared into the agency's Business Manager the way research assumes, this could require Advanced Access + Business Verification, a materially slower path.
- **Exact background-job tool choice (Inngest vs. plain Vercel Cron):** MEDIUM confidence — both are viable at this scale; the choice can be finalized during Phase 2 planning rather than locked in now, since it doesn't affect earlier phases.
- **BR-specific WhatsApp report formatting conventions:** Validated as a pattern (niche tools do this), but the exact format/structure that reads well pasted into WhatsApp wasn't deeply researched beyond "structured text block" — worth a lightweight check with the team's actual current manual report format during Phase 5 planning.
- **Whether all ~10 current clients share timezone/currency:** PITFALLS.md flags this as a common silent-corruption source; needs a quick factual check against the agency's actual client list early in Phase 2/1, since it changes whether Pitfall #7's mitigation is urgent or can be deferred.

## Sources

### Primary (HIGH confidence)
- Meta for Developers — Graph API Changelog, Versioning, Rate Limiting, Authorization, Insights Best Practices (developers.facebook.com) — API versions, deprecation schedule, rate-limit mechanics, System User auth pattern
- Google for Developers — Google Ads API Access Levels, Rate Limits, Quotas, OAuth/`login-customer-id` docs (developers.google.com) — developer token tiers, MCC auth model, quota caps
- Google Ads Developer Blog (Feb 2026) — confirms multi-week Basic Access approval backlog
- npm registry — live version/maintenance-activity lookups for all recommended packages (checked 2026-07-10)
- Next.js official docs — Node.js 20.9+ requirement for v16

### Secondary (MEDIUM confidence)
- AgencyAnalytics, Swydo, Reportei, Metrifiquei, GT Report — competitive feature/delivery-format analysis
- Productive.io, Scoro — PSA/contract-to-revenue pattern
- Railway Guides, Render — background-job architecture (cron vs. queue vs. worker) for small teams
- Datadog, IBM — alert fatigue prevention practices
- Infomaze Elite, LinkedIn case study — internal BI/dashboard adoption failure patterns

### Tertiary (LOW-MEDIUM confidence)
- Community/forum reports on Google Ads OAuth "Testing" status refresh-token expiry — consistent with documented OAuth behavior but not an official doc page
- Meta System User token best-practice guidance — corroborated across multiple integration guides, not a single official page

---
*Research completed: 2026-07-10*
*Ready for roadmap: yes*
